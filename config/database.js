// config/database.js — PostgreSQL connection pool
'use strict';

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err.message);
});

// Run idempotent startup migrations
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
            // Migrations are idempotent — log but don't crash
            console.log('[DB migration note]', err.message);
        }
    }
}

module.exports = { pool, runStartupMigrations };
