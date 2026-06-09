// app.js — NeurowexTech Express application
'use strict';

require('dotenv').config();

const express   = require('express');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

// ── Validate critical imports BEFORE using them ───────────────────────────────
const { runStartupMigrations } = require('./config/database');
const sessionMiddleware        = require('./config/session');
const { setupHandlebars }      = require('./config/handlebars');
const templateLocals           = require('./middleware/templateLocals');
const {
    apiJsonHeader,
    apiJsonSyntaxError,
    apiErrorHandler,
    apiNotFound,
    notFound,
    globalErrorHandler,
} = require('./middleware/errorHandler');
const routes = require('./routes/index');

// Fail fast with a clear message rather than a cryptic Express crash later
const required = { sessionMiddleware, templateLocals, apiJsonHeader,
                   apiErrorHandler, notFound, globalErrorHandler, routes };
for (const [name, val] of Object.entries(required)) {
    if (typeof val !== 'function') {
        throw new Error(`[app] "${name}" must be a function but got ${typeof val}. Check its module export.`);
    }
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'views', 'images')));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// CSP disabled — pages load assets from Google Fonts, cdnjs, etc.
// Enable and configure CSP directives before hardening further.
app.use(helmet({ contentSecurityPolicy: false }));

// ── Auth rate limiting ────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 20,                   // max 20 attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again in 15 minutes.' },
    skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api/login',    authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/auth',     authLimiter);

// ── Request logging (dev only) ────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ── Session ───────────────────────────────────────────────────────────────────
app.use(sessionMiddleware);

// ── View engine (Handlebars) ──────────────────────────────────────────────────
setupHandlebars(app);

// ── Template locals — injected into every render ──────────────────────────────
app.use(templateLocals);

// ── API JSON header (runs before routes so API errors are always JSON) ─────────
app.use(apiJsonHeader);

// ── Utility routes ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status:    'OK',
        timestamp: new Date().toISOString(),
        uptime:    process.uptime(),
        env:       process.env.NODE_ENV || 'development',
    });
});

app.get('/test-auth', (req, res) => {
    res.json({
        sessionExists:   !!req.session,
        userId:          req.session?.userId,
        userRole:        req.session?.userRole,
        isAuthenticated: !!req.session?.userId,
    });
});

if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/env', (req, res) => {
        res.json({
            googleClientId:   process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
            nodeEnv:          process.env.NODE_ENV,
            hasSessionSecret: !!process.env.SESSION_SECRET,
        });
    });
}

// ── Application routes ────────────────────────────────────────────────────────
app.use('/', routes);

// ── Error handlers — must come after all routes ───────────────────────────────
app.use(apiJsonSyntaxError);
app.use(apiErrorHandler);
app.use(apiNotFound);
app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;