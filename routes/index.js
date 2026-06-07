// routes/index.js — central route registry, mounted in app.js
'use strict';

const { Router } = require('express');

// ── Safe require: logs a warning instead of crashing if a module fails ────────
function safeRequire(path) {
    try {
        return require(path);
    } catch (err) {
        console.error(`[routes] Failed to load module "${path}": ${err.message}`);
        // Return a no-op router so the app still starts
        const r = Router();
        r.use((req, res, next) => {
            console.error(`[routes] Route from failed module "${path}" was called`);
            next();
        });
        return r;
    }
}

// Auth + dashboards
const authRoutes       = safeRequire('./auth.routes');
const dashboardRoutes  = safeRequire('./dashboard.routes');

// Web page routes
const homeRoutes       = safeRequire('./web/home.routes');
const blogRoutes       = safeRequire('./web/blog.routes');
const portfolioRoutes  = safeRequire('./web/portfolio.routes');
const learnRoutes      = safeRequire('./web/learn.routes');

// API routes
const userApi          = safeRequire('./api/user.api');
const adminApi         = safeRequire('./api/admin.api');
const contactsApi      = safeRequire('./api/contacts.api');
const coursesApi       = safeRequire('./api/courses.api');
const instructorApi    = safeRequire('./api/instructor.api');
const uploadApi        = safeRequire('./api/upload.api');
const publicApi        = safeRequire('./api/public.api');

const router = Router();

// ── Web / page routes ─────────────────────────────────────────────────────────
router.use('/', authRoutes);
router.use('/', dashboardRoutes);
router.use('/', homeRoutes);
router.use('/', blogRoutes);
router.use('/', portfolioRoutes);
router.use('/', learnRoutes);

// ── API routes ────────────────────────────────────────────────────────────────
router.use('/api/user',       userApi);
router.use('/api/admin',      adminApi);
router.use('/api/contacts',   contactsApi);
router.use('/api',            coursesApi);      // /api/enroll, /api/lesson/*, /api/learn/*, /api/courses/*
router.use('/api/instructor', instructorApi);
router.use('/api/upload',     uploadApi);
router.use('/api',            publicApi);       // /api/projects/public, /api/subscribe

module.exports = router;
