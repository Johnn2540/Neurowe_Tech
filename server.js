// server.js — application entry point
// Starts the HTTP server. All app logic lives in app.js.
'use strict';

require('dotenv').config();

const app                      = require('./app');
const { runStartupMigrations } = require('./config/database');

const isVercel = process.env.VERCEL === '1';
if (isVercel) console.log('Running on Vercel — serverless mode');

// Migrations run from config/database.js (schema bootstrapping).
// Keepalive is handled inside db/postgres.js after testConnection() succeeds.
runStartupMigrations().catch(err =>
    console.error('[startup] Migration error:', err.message)
);

// Export app for Vercel / other serverless platforms
module.exports = app;

// Start the HTTP server when NOT on Vercel (or when in development)
if (!isVercel || process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        const googleStatus = process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Not configured';
        const env          = process.env.NODE_ENV || 'development';
        console.log(
            '\n+=======================================================+' +
            `\n|  NeurowexTech  --  http://localhost:${PORT}` +
            `\n|  Google Sign-In : ${googleStatus}` +
            `\n|  Environment    : ${env}` +
            '\n|  Press Ctrl+C to stop' +
            '\n+=======================================================+\n'
        );
    });
}