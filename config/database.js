// config/database.js — PostgreSQL pool with Neon keepalive
'use strict';

const { Pool } = require('pg');

// ─── Pool ─────────────────────────────────────────────────────────────────────
// Neon free tier pauses after ~5 min inactivity and drops TCP connections.
// Settings below handle that gracefully:
//   • idleTimeoutMillis — release idle clients before Neon kills them
//   • connectionTimeoutMillis — don't wait forever on a dead connection
//   • max — keep pool small so Neon's connection limit isn't hit
//   • keepAlive / keepAliveInitialDelayMillis — TCP keepalive at socket level

const pool = new Pool({
    connectionString:              process.env.DATABASE_URL,
    ssl:                           { rejectUnauthorized: false },
    max:                           5,
    idleTimeoutMillis:             30_000,   // release idle client after 30 s
    connectionTimeoutMillis:       10_000,   // fail fast, then retry
    keepAlive:                     true,
    keepAliveInitialDelayMillis:   10_000,
});

pool.on('error', (err) => {
    // Log but don't crash — a new client will be created on the next query
    console.error('[DB] pool client error:', err.message);
});

pool.on('connect', () => {
    console.log('[DB] new client connected to Neon');
});

// ─── Keepalive ping ───────────────────────────────────────────────────────────
// Neon pauses after ~5 min. We ping every 4 min to keep it awake.
// Only runs in environments where DATABASE_URL is set.

let _pingInterval = null;

function startKeepalive() {
    if (_pingInterval) return;                       // already running
    if (!process.env.DATABASE_URL) return;           // no DB configured

    _pingInterval = setInterval(async () => {
        try {
            await pool.query('SELECT 1');
        } catch (err) {
            console.warn('[DB] keepalive ping failed (Neon may be waking):', err.message);
        }
    }, 4 * 60 * 1000);                              // every 4 minutes

    // Don't hold the Node process open just for this timer
    if (_pingInterval.unref) _pingInterval.unref();

    console.log('[DB] keepalive ping started (every 4 min)');
}

// ─── Resilient query helper ───────────────────────────────────────────────────
// Wraps pool.query with one automatic retry on connection errors.
// Use this in routes instead of pool.query directly when you want
// automatic reconnection on Neon cold-start.

async function query(text, params) {
    try {
        return await pool.query(text, params);
    } catch (err) {
        const isConnErr = (
            err.code === 'ECONNRESET'    ||
            err.code === 'ECONNREFUSED'  ||
            err.code === 'ETIMEDOUT'     ||
            err.code === '57P01'         ||   // admin_shutdown (Neon pause)
            err.message?.includes('Connection terminated') ||
            err.message?.includes('connection timeout')
        );

        if (isConnErr) {
            console.warn('[DB] connection error — retrying once:', err.message);
            await new Promise(r => setTimeout(r, 1_500)); // brief wait for Neon to wake
            return pool.query(text, params);              // one retry
        }

        throw err; // non-connection errors bubble up normally
    }
}

// ─── Startup migrations ───────────────────────────────────────────────────────

async function runStartupMigrations() {
    const migrations = [
        `CREATE TABLE IF NOT EXISTS "session" (
            "sid"    varchar   NOT NULL COLLATE "default",
            "sess"   json      NOT NULL,
            "expire" timestamp(6) NOT NULL,
            CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        )`,
        `CREATE TABLE IF NOT EXISTS contacts (
            id           SERIAL PRIMARY KEY,
            name         VARCHAR(150) NOT NULL,
            email        VARCHAR(255) NOT NULL,
            phone        VARCHAR(50),
            company      VARCHAR(150),
            project_type VARCHAR(200),
            budget       VARCHAR(100),
            message      TEXT NOT NULL,
            status       VARCHAR(20) DEFAULT 'new',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'new'`,
        `CREATE TABLE IF NOT EXISTS instructor_course_assignments (
            id            SERIAL PRIMARY KEY,
            instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (instructor_id, course_id)
        )`,
    ];

    for (const sql of migrations) {
        try {
            await pool.query(sql);
        } catch (err) {
            console.log('[DB migration note]', err.message);
        }
    }
}

module.exports = { pool, query, runStartupMigrations, startKeepalive };
