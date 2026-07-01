// config/session.js — express-session with PostgreSQL store
'use strict';

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./database');

const isProduction = process.env.NODE_ENV === 'production';

// Create session store with better error handling
const sessionStore = new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    ttl: 24 * 60 * 60,
    errorLog: (err) => { console.error('Session store error:', err.message); },
    pruneSessionInterval: 60,
});

// Custom middleware to handle session errors gracefully
const sessionMiddleware = session({
    store: sessionStore,
    secret: (() => {
        const s = process.env.SESSION_SECRET;
        if (!s)         throw new Error('SESSION_SECRET environment variable must be set');
        if (s.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
        return s;
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: 'lax',
    },
    proxy: true,
    // Add rolling to refresh cookie expiration
    rolling: true,
    // Don't save uninitialized sessions
    saveUninitialized: false,
    // Handle session save errors
    unset: 'keep',
});

// Wrapper to catch session errors
function safeSessionMiddleware(req, res, next) {
    try {
        sessionMiddleware(req, res, (err) => {
            if (err) {
                console.error('Session middleware error:', err.message);
                // Continue without session if there's an error
                req.session = {};
                return next();
            }
            next();
        });
    } catch (err) {
        console.error('Session error:', err.message);
        req.session = {};
        next();
    }
}

module.exports = safeSessionMiddleware;