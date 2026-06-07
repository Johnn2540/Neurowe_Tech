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
    // Add timeout for session operations
    ttl: 24 * 60 * 60, // 24 hours in seconds
    // Don't let session errors crash the app
    errorLog: (err) => {
        console.error('Session store error:', err.message);
        // Don't throw - just log and continue
    },
    // Prune expired sessions every hour
    pruneSessionInterval: 60,
    // Disable automatic table creation if connection fails (prevents crash loop)
    createTableIfMissing: false, // Set to false temporarily if connection fails
});

// Custom middleware to handle session errors gracefully
const sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'neurowex_secret_2024',
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