// app.js — NeurowexTech Express application
// All configuration, middleware, and routes are delegated to focused modules.
'use strict';

require('dotenv').config();

const express        = require('express');
const path           = require('path');

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

const app = express();

// ════════════════════════════════════════════════════════════════════════════
// STATIC FILES
// ════════════════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'views', 'images')));

// ════════════════════════════════════════════════════════════════════════════
// BODY PARSING
// ════════════════════════════════════════════════════════════════════════════

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ════════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ════════════════════════════════════════════════════════════════════════════

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// ════════════════════════════════════════════════════════════════════════════
// REQUEST LOGGING (dev only)
// ════════════════════════════════════════════════════════════════════════════

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION
// ════════════════════════════════════════════════════════════════════════════

app.use(sessionMiddleware);

// ════════════════════════════════════════════════════════════════════════════
// VIEW ENGINE (Handlebars)
// ════════════════════════════════════════════════════════════════════════════

setupHandlebars(app);

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE LOCALS — injected into every render
// ════════════════════════════════════════════════════════════════════════════

app.use(templateLocals);

// ════════════════════════════════════════════════════════════════════════════
// API JSON HEADER (runs before routes so API errors are always JSON)
// ════════════════════════════════════════════════════════════════════════════

app.use(apiJsonHeader);

// ════════════════════════════════════════════════════════════════════════════
// UTILITY ROUTES (health check, debug)
// ════════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(),
               uptime: process.uptime(), env: process.env.NODE_ENV || 'development' });
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

// ════════════════════════════════════════════════════════════════════════════
// APPLICATION ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.use('/', routes);

// ════════════════════════════════════════════════════════════════════════════
// ERROR HANDLERS — must be after all routes
// ════════════════════════════════════════════════════════════════════════════

app.use(apiJsonSyntaxError);
app.use(apiErrorHandler);
app.use(apiNotFound);
app.use(notFound);
app.use(globalErrorHandler);

// Add after all imports, before using them
console.log('🔍 Validating middleware imports...');
console.log('  sessionMiddleware:', typeof sessionMiddleware);
console.log('  templateLocals:', typeof templateLocals);
console.log('  apiJsonHeader:', typeof apiJsonHeader);
console.log('  apiErrorHandler:', typeof apiErrorHandler);
console.log('  routes:', typeof routes);

// Check and throw if any are invalid
if (typeof sessionMiddleware !== 'function') {
    throw new Error(`sessionMiddleware is not a function! Got: ${typeof sessionMiddleware}`);
}
if (typeof templateLocals !== 'function') {
    throw new Error(`templateLocals is not a function! Got: ${typeof templateLocals}`);
}
if (typeof routes !== 'function') {
    throw new Error(`routes is not a function! Got: ${typeof routes}`);
}

module.exports = app;
