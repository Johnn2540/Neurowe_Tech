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

// ─── Chat widget data ─────────────────────────────────────────────────────────
// Returns all content the AI chat widget needs (services, pricing, faqs, team,
// courses, contact). Called once per session by widget.js on first open.

router.get('/widget-data', async (req, res) => {
    const safe = (r) => (r.status === 'fulfilled' ? r.value.rows : []);

    const [services, pricing, faqs, team, courses, settings] = await Promise.allSettled([
        db.query(`SELECT name, description, price FROM services
                  WHERE visible IS NOT FALSE ORDER BY id LIMIT 20`),
        db.query(`SELECT name, tier, price, features FROM pricing_plans
                  ORDER BY id LIMIT 10`),
        db.query(`SELECT question, answer FROM faqs
                  WHERE active IS NOT FALSE ORDER BY display_order, id LIMIT 40`),
        db.query(`SELECT name, role, bio FROM team ORDER BY id LIMIT 10`),
        db.query(`SELECT title, category, level FROM courses
                  WHERE published = true ORDER BY id LIMIT 30`),
        db.query(`SELECT contact_email, whatsapp_number FROM settings LIMIT 1`),
    ]);

    const s = safe(settings)[0] || {};

    return res.json({
        success: true,
        data: {
            services: safe(services),
            pricing:  safe(pricing),
            faqs:     safe(faqs),
            team:     safe(team),
            courses:  safe(courses),
            contact: {
                email:    s.contact_email    || 'info@neurowextech.com',
                whatsapp: s.whatsapp_number  || '',
            },
        },
    });
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
