// routes/api/public.api.js — public API endpoints (no auth required)
'use strict';

const { Router } = require('express');
const db         = require('../../db/postgres');

const router = Router();

// ─── Public projects ──────────────────────────────────────────────────────────

router.get('/projects/public', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects WHERE featured=true ORDER BY created_at DESC');
        return res.json({ success: true, projects: r.rows });
    } catch { return res.json({ success: true, projects: [] }); }
});

router.get('/projects/featured', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM projects WHERE featured=true ORDER BY created_at DESC LIMIT 3'
        );
        return res.json({ success: true, projects: r.rows });
    } catch { return res.json({ success: true, projects: [] }); }
});

// ─── Newsletter subscribe ─────────────────────────────────────────────────────

router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        await db.query(
            `INSERT INTO subscribers (email, subscribed_at) VALUES ($1,NOW()) ON CONFLICT (email) DO NOTHING`,
            [email.toLowerCase()]
        );
        return res.json({ success: true, message: 'Subscribed successfully! 🎉' });
    } catch (err) {
        console.error('[public] subscribe error:', err);
        return res.status(400).json({ success: false, message: err.message || 'Subscription failed' });
    }
});

module.exports = router;
