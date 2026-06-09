// routes/index.js — central route registry, mounted in app.js
'use strict';

const { Router } = require('express');

// Auth + dashboards (critical — crash fast if broken)
const authRoutes      = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');

// Web page routes
const homeRoutes      = require('./web/home.routes');
const blogRoutes      = require('./web/blog.routes');
const portfolioRoutes = require('./web/portfolio.routes');
const learnRoutes     = require('./web/learn.routes');

// API routes
const userApi      = require('./api/user.api');
const adminApi     = require('./api/admin.api');
const contactsApi  = require('./api/contacts.api');
const coursesApi   = require('./api/courses.api');
const instructorApi = require('./api/instructor.api');
const uploadApi    = require('./api/upload.api');
const publicApi    = require('./api/public.api');

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
