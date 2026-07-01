// routes/api/mpesa.api.js — /api/mpesa/*
'use strict';

const { Router }            = require('express');
const { isAuthenticated }   = require('../../middleware/auth');
const db                    = require('../../db/postgres');
const { stkPush, stkQuery } = require('../../services/mpesa');

const router = Router();

const CALLBACK_URL = process.env.MPESA_CALLBACK_URL
    || 'https://neurowextech.vercel.app/api/mpesa/callback';

// ─── Ensure payments tables exist ─────────────────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS payments (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER REFERENCES users(id),
        course_id        INTEGER REFERENCES courses(id),
        phone            VARCHAR(15),
        amount           NUMERIC(10,2),
        merchant_req_id  VARCHAR(100),
        checkout_req_id  VARCHAR(100) UNIQUE,
        status           VARCHAR(20) DEFAULT 'pending',
        mpesa_receipt    VARCHAR(50),
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
`).catch(e => console.error('[mpesa] payments table error:', e.message));

db.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_payments (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        course_id   INTEGER REFERENCES courses(id),
        amount      NUMERIC(10,2),
        status      VARCHAR(20) DEFAULT 'pending',
        notes       TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
`).catch(e => console.error('[mpesa] whatsapp_payments table error:', e.message));

// ─── POST /api/mpesa/stk-push ──────────────────────────────────────────────────
router.post('/stk-push', isAuthenticated, async (req, res) => {
    try {
        const { courseId, phone } = req.body;
        const userId = req.session.userId;

        if (!courseId || !phone)
            return res.status(400).json({ success: false, message: 'courseId and phone required' });

        const cleaned = phone.replace(/\D/g, '').replace(/^0/, '254').replace(/^\+/, '');
        if (!/^2547\d{8}$/.test(cleaned))
            return res.status(400).json({ success: false, message: 'Invalid phone number (use 07XXXXXXXX or 2547XXXXXXXX)' });

        const cR = await db.query('SELECT id,title,price FROM courses WHERE id=$1 AND published=true', [courseId]);
        if (!cR.rows.length) return res.status(404).json({ success: false, message: 'Course not found' });
        const course = cR.rows[0];

        if (!course.price || parseFloat(course.price) <= 0)
            return res.status(400).json({ success: false, message: 'Course is free — use /api/enroll/free' });

        const alreadyR = await db.query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
        if (alreadyR.rows.length)
            return res.json({ success: false, alreadyEnrolled: true, message: 'Already enrolled',
                              redirect: `/learn/course/${courseId}/dashboard` });

        const push = await stkPush({
            phone:       cleaned,
            amount:      parseFloat(course.price),
            ref:         `Course${courseId}`,
            callbackUrl: CALLBACK_URL,
        });

        await db.query(`
            INSERT INTO payments (user_id,course_id,phone,amount,merchant_req_id,checkout_req_id,status)
            VALUES ($1,$2,$3,$4,$5,$6,'pending')
        `, [userId, courseId, cleaned, course.price, push.MerchantRequestID, push.CheckoutRequestID]);

        return res.json({
            success:          true,
            message:          'STK Push sent — enter your M-PESA PIN on your phone',
            checkoutRequestId: push.CheckoutRequestID,
        });
    } catch (err) {
        console.error('[mpesa] stk-push error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'STK Push failed' });
    }
});

// ─── GET /api/mpesa/status/:checkoutRequestId ─────────────────────────────────
router.get('/status/:checkoutRequestId', isAuthenticated, async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;
        const pR = await db.query(
            'SELECT status,mpesa_receipt,course_id FROM payments WHERE checkout_req_id=$1 AND user_id=$2',
            [checkoutRequestId, req.session.userId]
        );
        if (!pR.rows.length) return res.status(404).json({ success: false, message: 'Payment not found' });

        const payment = pR.rows[0];
        if (payment.status !== 'pending')
            return res.json({ success: true, status: payment.status,
                              receipt: payment.mpesa_receipt,
                              redirect: payment.status === 'success'
                                  ? `/learn/course/${payment.course_id}/dashboard` : null });

        // Poll Daraja if still pending
        const query = await stkQuery(checkoutRequestId);
        if (query.ResultCode === '0' || query.ResultCode === 0) {
            await db.query(
                "UPDATE payments SET status='success',updated_at=NOW() WHERE checkout_req_id=$1",
                [checkoutRequestId]
            );
            await enrollUser(payment.course_id, req.session.userId);
            return res.json({ success: true, status: 'success',
                              redirect: `/learn/course/${payment.course_id}/dashboard` });
        }
        if (query.ResultCode !== undefined && query.ResultCode !== '1032') {
            await db.query(
                "UPDATE payments SET status='failed',updated_at=NOW() WHERE checkout_req_id=$1",
                [checkoutRequestId]
            );
            return res.json({ success: true, status: 'failed', message: query.ResultDesc });
        }
        return res.json({ success: true, status: 'pending' });
    } catch (err) {
        console.error('[mpesa] status error:', err.message);
        return res.status(500).json({ success: false, message: 'Status check failed' });
    }
});

// ─── POST /api/mpesa/callback — Safaricom pushes result here ──────────────────
router.post('/callback', async (req, res) => {
    // Reject forged callbacks — Safaricom includes our secret token in the URL
    const expectedToken = process.env.MPESA_CALLBACK_TOKEN;
    if (expectedToken && req.query.token !== expectedToken) {
        console.warn('[mpesa] callback rejected: invalid token from', req.ip);
        return res.status(403).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
    }

    try {
        const body   = req.body?.Body?.stkCallback;
        const reqId  = body?.CheckoutRequestID;
        const code   = body?.ResultCode;
        const desc   = body?.ResultDesc;

        if (!reqId) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

        if (code === 0) {
            const items = body?.CallbackMetadata?.Item || [];
            const get   = name => items.find(i => i.Name === name)?.Value;
            const receipt = get('MpesaReceiptNumber');

            await db.query(
                "UPDATE payments SET status='success',mpesa_receipt=$1,updated_at=NOW() WHERE checkout_req_id=$2",
                [receipt || null, reqId]
            );

            const pR = await db.query(
                'SELECT user_id,course_id FROM payments WHERE checkout_req_id=$1', [reqId]
            );
            if (pR.rows.length) {
                const { user_id, course_id } = pR.rows[0];
                await enrollUser(course_id, user_id);
            }
        } else {
            await db.query(
                "UPDATE payments SET status='failed',updated_at=NOW() WHERE checkout_req_id=$1", [reqId]
            );
            console.log(`[mpesa] payment failed ${reqId}: ${desc}`);
        }

        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err) {
        console.error('[mpesa] callback error:', err.message);
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // always ACK Safaricom
    }
});

// ─── POST /api/mpesa/whatsapp-notify — user notifies admin after WhatsApp payment ──
router.post('/whatsapp-notify', isAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.session.userId;
        if (!courseId) return res.status(400).json({ success: false, message: 'courseId required' });

        const cR = await db.query('SELECT id,title,price FROM courses WHERE id=$1 AND published=true', [courseId]);
        if (!cR.rows.length) return res.status(404).json({ success: false, message: 'Course not found' });

        const enrolledR = await db.query(
            'SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]
        );
        if (enrolledR.rows.length)
            return res.json({ success: false, alreadyEnrolled: true, message: 'You are already enrolled in this course.' });

        const existingR = await db.query(
            "SELECT id FROM whatsapp_payments WHERE user_id=$1 AND course_id=$2 AND status='pending'",
            [userId, courseId]
        );
        if (existingR.rows.length)
            return res.json({ success: true, message: 'Notification already submitted — please wait for admin review.' });

        await db.query(
            "INSERT INTO whatsapp_payments (user_id,course_id,amount,status) VALUES ($1,$2,$3,'pending')",
            [userId, courseId, cR.rows[0].price]
        );
        return res.json({ success: true, message: 'Notified! Our team will verify and enrol you shortly.' });
    } catch (err) {
        console.error('[mpesa] whatsapp-notify error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to submit notification.' });
    }
});

async function enrollUser(courseId, userId) {
    const exists = await db.query(
        'SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]
    );
    if (exists.rows.length) return;
    await db.query(
        "INSERT INTO enrollments (user_id,course_id,enrolled_at,progress,status) VALUES ($1,$2,NOW(),0,'active')",
        [userId, courseId]
    );
    await db.query('UPDATE courses SET enrolled_count=COALESCE(enrolled_count,0)+1 WHERE id=$1', [courseId]);
    const cR = await db.query('SELECT title FROM courses WHERE id=$1', [courseId]);
    await db.query(
        "INSERT INTO user_activities (user_id,activity,type,created_at) VALUES ($1,$2,'enrollment',NOW())",
        [userId, `Enrolled in ${cR.rows[0]?.title || 'a course'}`]
    ).catch(() => {});
}

module.exports = router;
