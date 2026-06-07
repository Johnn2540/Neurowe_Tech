// routes/web/portfolio.routes.js — /portfolio, /portfolio/:id
'use strict';

const { Router } = require('express');
const db         = require('../../db/postgres');

const router = Router();

router.get('/portfolio', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        return res.render('portfolio', { title: 'Portfolio – NeurowexTech', projects: r.rows });
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
