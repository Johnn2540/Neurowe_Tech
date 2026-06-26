// routes/web/home.routes.js — /, /about, /contact, /services, /privacy, /terms, /cookie, /subscribe
'use strict';

const { Router }         = require('express');
const db                 = require('../../db/postgres');

const router = Router();

// ─── Homepage ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const [featuredR, blogsR, coursesR] = await Promise.all([
            db.query('SELECT * FROM projects ORDER BY created_at DESC LIMIT 4')
              .catch(() => ({ rows: [] })),
            db.query("SELECT id,title,slug,category,excerpt,image_url,created_at FROM blog_posts WHERE published=true ORDER BY created_at DESC LIMIT 3")
              .catch(() => ({ rows: [] })),
            db.query(`SELECT c.*, u.username AS instructor_name,
                             (SELECT COUNT(*) FROM courses WHERE published=true) AS total_count
                      FROM courses c
                      LEFT JOIN users u ON u.id = c.instructor_id
                      WHERE c.published = true
                      ORDER BY c.created_at DESC LIMIT 3`)
              .catch(() => ({ rows: [] })),
        ]);
        const blogs = blogsR.rows.map(p => ({
            ...p,
            created_at: p.created_at
                ? new Date(p.created_at).toLocaleDateString('en-KE', {
                      year: 'numeric', month: 'short', day: 'numeric',
                  }) : '',
        }));
        const courseCount = parseInt(coursesR.rows[0]?.total_count || 0, 10);
        return res.render('home', {
            title:            'NeurowexTech – Web & Mobile Apps That Actually Ship',
            description:      'Custom web and mobile app development for startups and businesses.',
            featuredProjects: featuredR.rows,
            recentBlogs:      blogs,
            featuredCourses:  coursesR.rows,
            courseCount,
        });
    } catch (err) {
        console.error('[home] render error:', err);
        return res.render('home', { title: 'NeurowexTech', featuredProjects: [], recentBlogs: [], featuredCourses: [], courseCount: 0 });
    }
});

// ─── Service pages ────────────────────────────────────────────────────────────

router.get('/web_dev',       (req, res) => res.render('web_dev',       { title: 'Web & App Development – NeurowexTech' }));
router.get('/graphic_design',(req, res) => res.render('graphic_design',{ title: 'Graphic Design & Branding – NeurowexTech' }));
router.get('/seo',           (req, res) => res.render('seo',           { title: 'SEO & Digital Marketing – NeurowexTech' }));
router.get('/ai-solutions',  (req, res) => res.render('ai-solutions',  { title: 'AI Solutions – NeurowexTech' }));
router.get('/cybersecurity', (req, res) => res.render('cybersecurity', { title: 'Cybersecurity Services – NeurowexTech' }));
router.get('/uiux',          (req, res) => res.render('uiux',          { title: 'UI/UX Design – NeurowexTech' }));
router.get('/ecommerce',     (req, res) => res.render('ecommerce',     { title: 'E-Commerce Solutions – NeurowexTech' }));
router.get('/analytics',     (req, res) => res.render('analytics',     { title: 'Data Analytics & BI – NeurowexTech' }));
router.get('/social-media',  (req, res) => res.render('social-media',  { title: 'Social Media & Content – NeurowexTech' }));

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

// ─── Sitemap ──────────────────────────────────────────────────────────────────

const SITE = 'https://neurowextech.co.ke';

const STATIC_PAGES = [
    { loc: '/',                 changefreq: 'weekly',  priority: '1.0' },
    { loc: '/about',            changefreq: 'monthly', priority: '0.8' },
    { loc: '/services',         changefreq: 'monthly', priority: '0.8' },
    { loc: '/contact',          changefreq: 'monthly', priority: '0.7' },
    { loc: '/blog',             changefreq: 'daily',   priority: '0.9' },
    { loc: '/learn',            changefreq: 'weekly',  priority: '0.9' },
    { loc: '/web_dev',          changefreq: 'monthly', priority: '0.7' },
    { loc: '/graphic_design',   changefreq: 'monthly', priority: '0.7' },
    { loc: '/seo',              changefreq: 'monthly', priority: '0.7' },
    { loc: '/ai-solutions',     changefreq: 'monthly', priority: '0.7' },
    { loc: '/cybersecurity',    changefreq: 'monthly', priority: '0.7' },
    { loc: '/uiux',             changefreq: 'monthly', priority: '0.7' },
    { loc: '/ecommerce',        changefreq: 'monthly', priority: '0.7' },
    { loc: '/analytics',        changefreq: 'monthly', priority: '0.7' },
    { loc: '/social-media',     changefreq: 'monthly', priority: '0.7' },
    { loc: '/kids-coding',      changefreq: 'monthly', priority: '0.6' },
    { loc: '/become-instructor',changefreq: 'monthly', priority: '0.6' },
    { loc: '/learn/fullstack',  changefreq: 'monthly', priority: '0.7' },
    { loc: '/learn/ai',         changefreq: 'monthly', priority: '0.7' },
    { loc: '/portfolio',        changefreq: 'monthly', priority: '0.7' },
];

router.get('/sitemap.xml', async (req, res) => {
    try {
        const [postsR, coursesR] = await Promise.all([
            db.query("SELECT slug, updated_at, created_at FROM blog_posts WHERE published=true ORDER BY created_at DESC")
              .catch(() => ({ rows: [] })),
            db.query("SELECT id, updated_at, created_at FROM courses WHERE published=true ORDER BY created_at DESC")
              .catch(() => ({ rows: [] })),
        ]);

        const url = (loc, lastmod, changefreq, priority) =>
            `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

        const today = new Date().toISOString().split('T')[0];

        const staticUrls = STATIC_PAGES.map(p => url(p.loc, today, p.changefreq, p.priority));

        const blogUrls = postsR.rows.map(p => {
            const d = (p.updated_at || p.created_at || new Date()).toISOString().split('T')[0];
            return url(`/blog/${p.slug}`, d, 'monthly', '0.8');
        });

        const courseUrls = coursesR.rows.map(c => {
            const d = (c.updated_at || c.created_at || new Date()).toISOString().split('T')[0];
            return url(`/learn/course/${c.id}`, d, 'weekly', '0.8');
        });

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...staticUrls, ...blogUrls, ...courseUrls,
            '</urlset>',
        ].join('\n');

        res.header('Content-Type', 'application/xml');
        return res.send(xml);
    } catch (err) {
        console.error('[sitemap] error:', err.message);
        return res.status(500).send('Sitemap generation failed');
    }
});

module.exports = router;