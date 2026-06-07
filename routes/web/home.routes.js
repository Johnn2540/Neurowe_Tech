// routes/web/home.routes.js — /, /about, /contact, /services, /privacy, /terms, /cookie, /subscribe
'use strict';

const { Router }         = require('express');
const db                 = require('../../db/postgres');

const router = Router();

// ─── Homepage ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const [featuredR, blogsR] = await Promise.all([
            db.query('SELECT * FROM projects WHERE featured=true ORDER BY created_at DESC LIMIT 6')
              .catch(() => ({ rows: [] })),
            db.query("SELECT * FROM blog_posts WHERE published=true ORDER BY created_at DESC LIMIT 3")
              .catch(() => ({ rows: [] })),
        ]);
        const blogs = blogsR.rows.map(p => ({
            ...p,
            created_at: p.created_at
                ? new Date(p.created_at).toLocaleDateString('en-KE', {
                      year: 'numeric', month: 'short', day: 'numeric',
                  }) : '',
        }));
        return res.render('home', {
            title:            'NeurowexTech – Web & Mobile Apps That Actually Ship',
            description:      'Custom web and mobile app development for startups and businesses.',
            featuredProjects: featuredR.rows,
            recentBlogs:      blogs,
        });
    } catch (err) {
        console.error('[home] render error:', err);
        return res.render('home', { title: 'NeurowexTech', featuredProjects: [], recentBlogs: [] });
    }
});

// ─── Static pages ─────────────────────────────────────────────────────────────

router.get('/services',          (req, res) => res.render('services',          { title: 'Services – NeurowexTech' }));
router.get('/about',             (req, res) => res.render('about',             { title: 'About – NeurowexTech' }));
router.get('/privacy-policy',    (req, res) => res.render('privacy-policy',    { title: 'Privacy Policy – NeurowexTech' }));
router.get('/terms-of-service',  (req, res) => res.render('terms-of-service',  { title: 'Terms of Service – NeurowexTech' }));
router.get('/cookie-policy',     (req, res) => res.render('cookie-policy',     { title: 'Cookie Policy – NeurowexTech' }));
router.get('/become-instructor', (req, res) => res.render('become_instructor', { title: 'Become an Instructor – NeurowexTech Academy' }));
router.get('/kids-coding',       (req, res) => res.render('kids-coding',       { title: 'Kids & Teen Coding Academy – NeurowexTech' }));
router.get('/learn/fullstack',   (req, res) => res.render('fullstack',         { title: 'Full Stack Software Engineering – NeurowexTech Academy' }));
router.get('/learn/graphic-design',(req, res)=> res.render('graphic-design',   { title: 'Professional Graphic Design – NeurowexTech Academy' }));
router.get('/learn/ai',          (req, res) => res.render('ai-course',         { title: 'Artificial Intelligence (AI) – NeurowexTech Academy' }));

// ─── Contact ──────────────────────────────────────────────────────────────────

router.get('/contact', (req, res) => res.render('contact', { title: 'Contact – NeurowexTech' }));

router.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, project_type, budget, message, company, services } = req.body;
        const isJson = req.is('application/json');
        const errors = [];
        if (!name    || name.trim().length < 2)         errors.push('Please enter your full name');
        if (!email   || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Please enter a valid email');
        if (!message || message.trim().length < 10)     errors.push('Please provide more project details');

        if (errors.length) {
            if (isJson) return res.status(400).json({ success: false, message: errors.join('. ') });
            return res.render('contact', { title: 'Contact', error: errors.join('. '), formData: req.body });
        }

        const resolvedType = Array.isArray(services) && services.length
            ? services.join(', ')
            : (project_type || '');

        await db.query(
            `INSERT INTO contacts (name,email,phone,project_type,budget,message,company,status,created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'new',NOW())`,
            [name.trim(), email.trim(), phone||'', resolvedType, budget||'', message.trim(), company||'']
        );
        console.log(`[contact] New message from ${name} <${email}> — ${resolvedType}`);

        if (isJson) return res.json({ success: true, message: "Thank you! We'll respond within 24 hours." });
        return res.render('contact', { title: 'Contact', success: "Thank you! We'll respond within 24 hours." });
    } catch (err) {
        console.error('[contact] POST error:', err.message);
        if (req.is('application/json'))
            return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
        return res.render('contact', { title: 'Contact', error: 'Something went wrong. Please try again.', formData: req.body });
    }
});

// ─── Newsletter subscribe (web form fallback) ─────────────────────────────────

router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        await db.query(
            `INSERT INTO subscribers (email,subscribed_at) VALUES ($1,NOW()) ON CONFLICT (email) DO NOTHING`,
            [email.toLowerCase()]
        );
        return res.json({ success: true, message: 'Subscribed successfully! 🎉' });
    } catch (err) {
        console.error('[subscribe] error:', err);
        return res.status(400).json({ success: false, message: err.message || 'Subscription failed' });
    }
});

module.exports = router;
