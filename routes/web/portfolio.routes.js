// routes/web/portfolio.routes.js — /portfolio, /portfolio/:id
'use strict';

const { Router } = require('express');
const db         = require('../../db/postgres');

const router = Router();

const PROJECT_META = {
    FitSync:    { image_url: '/images/FitSync.jpg',    live_demo_url: 'https://fitsync.com' },
    ChatSphere: { image_url: '/images/ChatSphere.jpg', live_demo_url: 'https://chatsphere.io/' },
    TaskFlow:   { image_url: '/images/TaskFlow.jpg',   live_demo_url: 'https://taskflowapp.com/' },
    MediBook:   { image_url: '/images/MediBook.jpg',   live_demo_url: 'https://edu365.uk/' },
    ShopEase:   { image_url: '/images/ShopEase.jpg',   live_demo_url: 'https://www.shopeaseapp.com/' },
};

router.get('/portfolio', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects ORDER BY featured DESC, created_at DESC');
        const projects = r.rows.map(p => {
            const meta = PROJECT_META[p.name] || {};
            return {
                ...p,
                image_url:     p.image_url     || meta.image_url     || null,
                live_demo_url: p.live_demo_url || meta.live_demo_url || null,
            };
        });
        return res.render('portfolio', { title: 'Portfolio – NeurowexTech', projects });
    } catch {
        return res.render('portfolio', { title: 'Portfolio', projects: [] });
    }
});

router.get('/portfolio/:id', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).render('404', { title: 'Project Not Found' });
        return res.render('portfolio-detail', {
            title: `${r.rows[0].name} – NeurowexTech`, project: r.rows[0],
        });
    } catch (err) {
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

module.exports = router;
