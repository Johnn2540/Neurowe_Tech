// routes/auth.routes.js
'use strict';

const { Router } = require('express');
const { isAuthenticated } = require('../middleware/auth');
const db   = require('../db/postgres');
const ctrl = require('../controllers/auth.controller');

const router = Router();

function redirectForRole(role) {
    if (role === 'admin')       return '/admin_dashboard';
    if (role === 'instructor')  return '/instructor/dashboard';
    return '/user_dashboard';
}

// ── View routes ──────────────────────────────────────────────────────────────

router.get('/sign_up', (req, res) => {
    if (req.session.userId)
        return res.redirect(redirectForRole(req.session.userRole));
    res.render('sign_up', {
        title:          'Create Account – NeurowexTech',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    });
});
router.get('/signup', (req, res) => res.redirect('/sign_up'));

router.get('/login', (req, res) => {
    if (req.session.userId)
        return res.redirect(redirectForRole(req.session.userRole));
    const next = req.query.next || '';
    res.render('login', {
        title:          'Sign In – NeurowexTech',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        next,
    });
});
router.get('/signin', (req, res) => {
    const qs = req.query.next ? `?next=${encodeURIComponent(req.query.next)}` : '';
    return res.redirect(`/login${qs}`);
});

router.get('/forgot-password', (req, res) =>
    res.render('reset-password', { title: 'Forgot Password – NeurowexTech', mode: 'forgot' }));

router.get('/reset-password', (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/forgot-password');
    res.render('reset-password', { title: 'Reset Password – NeurowexTech', mode: 'reset', token });
});

router.get('/logout', ctrl.logout);

// ── Email verification ────────────────────────────────────────────────────────

router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/login');
    try {
        const rec = await db.query(
            'SELECT * FROM email_verifications WHERE token=$1 AND expires_at > NOW()', [token]
        );
        if (!rec.rows.length) {
            return res.render('login', {
                title:          'Sign In – NeurowexTech',
                googleClientId: process.env.GOOGLE_CLIENT_ID || '',
                verifyError:    'This verification link is invalid or has expired. Please request a new one.',
            });
        }
        await db.query('UPDATE users SET email_verified=true WHERE email=$1', [rec.rows[0].email]);
        await db.query('DELETE FROM email_verifications WHERE token=$1', [token]);
        return res.render('login', {
            title:          'Sign In – NeurowexTech',
            googleClientId: process.env.GOOGLE_CLIENT_ID || '',
            verifySuccess:  'Email verified! You can now sign in.',
        });
    } catch (err) {
        console.error('[auth] verify-email error:', err);
        return res.redirect('/login');
    }
});

// ── API routes ───────────────────────────────────────────────────────────────

router.post('/api/register',              ctrl.register);
router.post('/api/signup',                ctrl.register);       // alias
router.post('/api/login',                 ctrl.login);
router.post('/api/auth/google',           ctrl.googleAuth);
router.post('/api/forgot-password',       ctrl.forgotPassword);
router.post('/api/reset-password',        ctrl.resetPassword);
router.post('/api/resend-verification',   ctrl.resendVerification);

module.exports = router;
