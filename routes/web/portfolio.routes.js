// routes/web/portfolio.routes.js — /portfolio, /portfolio/:id
'use strict';

const { Router } = require('express');
const db         = require('../../db/postgres');

const router = Router();

// Keys are lowercase so lookup works regardless of how names are cased in the DB
const PROJECT_META = {
    'fitsync':      { image_url: '/images/FitSync.jpg',    live_demo_url: 'https://fitsync.com' },
    'chatsphere':   { image_url: '/images/ChatSphere.jpg', live_demo_url: 'https://chatsphere.io/' },
    'taskflow':     { image_url: '/images/TaskFlow.jpg',   live_demo_url: 'https://taskflowapp.com/' },
    'medibook':     { image_url: '/images/MediBook.jpg',   live_demo_url: 'https://edu365.uk/' },
    'shopease':     { image_url: '/images/ShopEase.jpg',   live_demo_url: 'https://www.shopeaseapp.com/' },
    'ecoshop':      { image_url: '/images/eco_shop.png' },
    'eco shop':     { image_url: '/images/eco_shop.png' },
    'medicare':     { image_url: '/images/medicare.png' },
    'edulearn':     { image_url: '/images/edulearn.png' },
    'docuai':       { image_url: '/images/docuai.png' },
    'fittrack':     { image_url: '/images/fittrack.png' },
    'datadash':     { image_url: '/images/datadash.png' },
    'dashboard ui': { image_url: '/images/dashboard ui.jpg' },
    'dashboardui':  { image_url: '/images/dashboard ui.jpg' },
};

function enrichProject(p) {
    const meta = PROJECT_META[(p.name || '').toLowerCase().trim()] || {};
    return {
        ...p,
        // META wins — these are known-good paths; DB value is fallback
        image_url:     meta.image_url     || p.image_url     || null,
        live_demo_url: meta.live_demo_url || p.live_demo_url || null,
    };
}

router.get('/portfolio', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects ORDER BY featured DESC, created_at DESC');
        const projects = r.rows.map(enrichProject);
        return res.render('portfolio', { title: 'Portfolio – NeurowexTech', projects });
    } catch (err) {
        console.error('[portfolio] list error:', err.message);
        return res.render('portfolio', { title: 'Portfolio', projects: [] });
    }
});

router.get('/portfolio/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(404).render('404', { title: 'Project Not Found' });
        const r = await db.query('SELECT * FROM projects WHERE id=$1', [id]);
        if (!r.rows.length)
            return res.status(404).render('404', { title: 'Project Not Found' });
        return res.render('portfolio-detail', {
            title: `${r.rows[0].name} – NeurowexTech`, project: r.rows[0],
        });
    } catch (err) {
        console.error('[portfolio] detail error:', err.message);
        return res.status(500).render('error', { title: 'Error', message: 'Something went wrong. Please try again later.' });
    }
});

module.exports = router;
