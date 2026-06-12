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
        `CREATE TABLE IF NOT EXISTS user_children (
            id           SERIAL PRIMARY KEY,
            parent_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name         VARCHAR(100) NOT NULL,
            age          INTEGER,
            avatar_emoji VARCHAR(10) DEFAULT '🧒',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS kids_enrollments (
            id          SERIAL PRIMARY KEY,
            parent_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            child_id    INTEGER NOT NULL REFERENCES user_children(id) ON DELETE CASCADE,
            course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            progress    INTEGER DEFAULT 0,
            status      VARCHAR(20) DEFAULT 'active',
            UNIQUE(child_id, course_id)
        )`,
        `CREATE TABLE IF NOT EXISTS kids_lesson_progress (
            id           SERIAL PRIMARY KEY,
            child_id     INTEGER NOT NULL REFERENCES user_children(id) ON DELETE CASCADE,
            lesson_id    INTEGER NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
            completed    BOOLEAN DEFAULT false,
            completed_at TIMESTAMPTZ,
            UNIQUE(child_id, lesson_id)
        )`,
        `ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true`,
        `ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT`,
        `ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS attachment_url        TEXT`,
        `ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS attachment_name       TEXT`,
        `ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS attachment_public_id  TEXT`,
        `ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN NOT NULL DEFAULT true`,
        `CREATE TABLE IF NOT EXISTS course_certificates (
            id                    SERIAL PRIMARY KEY,
            user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id             INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            issued_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
            certificate_url       TEXT NOT NULL,
            certificate_public_id TEXT,
            issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, course_id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_cc_user   ON course_certificates(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_cc_course ON course_certificates(course_id)`,
        `CREATE INDEX IF NOT EXISTS idx_cc_issued ON course_certificates(issued_at DESC)`,
        `CREATE TABLE IF NOT EXISTS user_lesson_progress (
            id           SERIAL PRIMARY KEY,
            user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lesson_id    INTEGER NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
            completed    BOOLEAN DEFAULT false,
            completed_at TIMESTAMPTZ,
            UNIQUE(user_id, lesson_id)
        )`,
        `CREATE TABLE IF NOT EXISTS user_activities (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            activity   TEXT NOT NULL,
            type       VARCHAR(50) DEFAULT 'general',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS course_reviews (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
            review     TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, course_id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_ulp_user   ON user_lesson_progress(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_ulp_lesson ON user_lesson_progress(lesson_id)`,
        `CREATE INDEX IF NOT EXISTS idx_ua_user    ON user_activities(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_cr_course  ON course_reviews(course_id)`,

        // ── Performance indexes ────────────────────────────────────────────────
        // blog_posts — filtered on every blog page load
        `CREATE INDEX IF NOT EXISTS idx_bp_published    ON blog_posts(published) WHERE published=true`,
        `CREATE INDEX IF NOT EXISTS idx_bp_slug         ON blog_posts(slug)`,
        `CREATE INDEX IF NOT EXISTS idx_bp_category     ON blog_posts(category)`,
        `CREATE INDEX IF NOT EXISTS idx_bp_created      ON blog_posts(created_at DESC)`,

        // courses — filtered on every homepage / academy page load
        `CREATE INDEX IF NOT EXISTS idx_c_published     ON courses(published) WHERE published=true`,
        `CREATE INDEX IF NOT EXISTS idx_c_instructor    ON courses(instructor_id)`,
        `CREATE INDEX IF NOT EXISTS idx_c_created       ON courses(created_at DESC)`,

        // projects — filtered on homepage and portfolio page
        `CREATE INDEX IF NOT EXISTS idx_p_featured      ON projects(featured) WHERE featured=true`,
        `CREATE INDEX IF NOT EXISTS idx_p_created       ON projects(created_at DESC)`,

        // course_modules — joined on every course detail load
        `CREATE INDEX IF NOT EXISTS idx_cm_course_id    ON course_modules(course_id)`,

        // enrollments — checked on every course page and dashboard
        `CREATE INDEX IF NOT EXISTS idx_e_user_id       ON enrollments(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_e_course_id     ON enrollments(course_id)`,

        // session table — expire lookup on every authenticated request
        `CREATE INDEX IF NOT EXISTS idx_session_expire  ON "session"(expire)`,

        // contacts — filtered by status in admin dashboard
        `CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)`,
        `CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC)`,

        // user_activities — fetched per user on dashboard
        `CREATE INDEX IF NOT EXISTS idx_ua_created ON user_activities(created_at DESC)`,
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
