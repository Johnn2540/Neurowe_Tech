-- ================================================================
--  NeurowexTech — Complete PostgreSQL Schema
--  Run this once on a fresh database to create all tables.
--  Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout.
-- ================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- optional: powers fast ILIKE search

-- ================================================================
-- 1. USERS
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100)        NOT NULL,
    email           VARCHAR(255)        NOT NULL UNIQUE,
    password_hash   TEXT,                          -- NULL for Google-only accounts
    google_id       VARCHAR(255)        UNIQUE,
    role            VARCHAR(20)         NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'admin')),
    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ,
    avatar_url      TEXT,
    bio             TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_google   ON users (google_id);

-- ================================================================
-- 2. SESSION (connect-pg-simple)
-- ================================================================
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR      NOT NULL COLLATE "default",
    "sess"   JSON         NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire);

-- ================================================================
-- 3. PASSWORD RESETS
-- ================================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    token      TEXT         NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 4. CONTACTS  (enquiries from home.hbs contact form)
-- ================================================================
CREATE TABLE IF NOT EXISTS contacts (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    phone        VARCHAR(50),
    company      VARCHAR(150),
    project_type VARCHAR(200),
    budget       VARCHAR(100),
    message      TEXT         NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'read', 'replied')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_status  ON contacts (status);

-- ================================================================
-- 5. SUBSCRIBERS  (newsletter)
-- ================================================================
CREATE TABLE IF NOT EXISTS subscribers (
    id             SERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    subscribed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 6. PROJECTS  (portfolio showcase + user project requests)
-- ================================================================
CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100) DEFAULT 'Web',
    year        INTEGER      DEFAULT EXTRACT(YEAR FROM NOW()),
    featured    BOOLEAN      NOT NULL DEFAULT FALSE,
    client_url  TEXT,
    tech_stack  TEXT,                        -- comma-separated
    image       VARCHAR(255),
    image_url   TEXT,                          -- alias for image, kept in sync via trigger
    -- User-facing project tracking
    project_type VARCHAR(150),
    budget      NUMERIC(12,2),
    status      VARCHAR(50)  DEFAULT 'Planning'
                CHECK (status IN ('Planning','In Progress','Review','Completed','On Hold')),
    progress    INTEGER      DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_featured  ON projects (featured);
CREATE INDEX IF NOT EXISTS idx_projects_user      ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_category  ON projects (category);

-- ================================================================
-- 7. BLOG POSTS
-- ================================================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(300) NOT NULL,
    slug         VARCHAR(300) NOT NULL UNIQUE,
    category     VARCHAR(100) DEFAULT 'General',
    author       VARCHAR(150) DEFAULT 'Admin',
    excerpt      TEXT,
    content      TEXT,
    external_url TEXT,
    image_url    TEXT,
    read_time    SMALLINT,                         -- minutes, e.g. 8
    published    BOOLEAN      NOT NULL DEFAULT FALSE,
    featured     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blog_slug      ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts (published, created_at DESC);

-- ================================================================
-- 8. SERVICES
-- ================================================================
CREATE TABLE IF NOT EXISTS services (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    icon_class  VARCHAR(100),               -- e.g. "fas fa-laptop-code"
    price       VARCHAR(100),               -- display string e.g. "From Kshs 12,000"
    visible     BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INTEGER      DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 9. TESTIMONIALS
-- ================================================================
CREATE TABLE IF NOT EXISTS testimonials (
    id          SERIAL PRIMARY KEY,
    client_name VARCHAR(150) NOT NULL,
    client_role VARCHAR(150),
    company     VARCHAR(200),
    rating      SMALLINT     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    content     TEXT         NOT NULL,
    avatar_url  TEXT,
    published   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 10. TEAM
-- ================================================================
CREATE TABLE IF NOT EXISTS team (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    role         VARCHAR(150) NOT NULL,
    bio          TEXT,
    avatar_url   TEXT,
    linkedin_url TEXT,
    github_url   TEXT,
    twitter_url  TEXT,
    sort_order   INTEGER      DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 11. FAQs
-- ================================================================
CREATE TABLE IF NOT EXISTS faqs (
    id            SERIAL PRIMARY KEY,
    question      TEXT    NOT NULL,
    answer        TEXT    NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_order ON faqs (display_order, id);

-- ================================================================
-- 12. PRICING PLANS
-- ================================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    tier        VARCHAR(200),                    -- subtitle e.g. "For growing businesses"
    price       NUMERIC(12,2) NOT NULL DEFAULT 0,
    price_label VARCHAR(100),                    -- display string e.g. "Kshs 17,999"
    features    JSONB        NOT NULL DEFAULT '[]',
    popular     BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 13. SETTINGS  (single-row config table)
-- ================================================================
CREATE TABLE IF NOT EXISTS settings (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    site_name       VARCHAR(200) DEFAULT 'NeurowexTech',
    contact_email   VARCHAR(255) DEFAULT 'techneurowex@gmail.com',
    whatsapp_number VARCHAR(50)  DEFAULT '+254769329340',
    location        VARCHAR(200) DEFAULT 'Nairobi, Kenya',
    tagline         TEXT,
    maintenance_mode BOOLEAN     DEFAULT FALSE,
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT settings_one_row CHECK (id = 1)
);

-- Seed one row so PUT /api/settings always works
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 14. COURSES  (Academy)
-- ================================================================
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) UNIQUE,
    description     TEXT,
    category        VARCHAR(100) DEFAULT 'Web Development',
    level           VARCHAR(50)  DEFAULT 'Beginner'
                    CHECK (level IN ('Beginner','Intermediate','Advanced')),
    price           NUMERIC(10,2) NOT NULL DEFAULT 0,
    image_url       TEXT,
    instructor_id   INTEGER REFERENCES users (id) ON DELETE SET NULL,
    instructor_name VARCHAR(150),              -- denormalised for display speed
    instructor_initial CHAR(2),
    total_modules   INTEGER      DEFAULT 0,
    total_lessons   INTEGER      DEFAULT 0,
    total_duration  VARCHAR(50),               -- e.g. "8 weeks"
    rating          NUMERIC(3,1) DEFAULT 0,
    enrolled_count  INTEGER      DEFAULT 0,
    published       BOOLEAN      NOT NULL DEFAULT FALSE,
    featured        BOOLEAN      NOT NULL DEFAULT FALSE,
    bestseller      BOOLEAN      NOT NULL DEFAULT FALSE,
    new             BOOLEAN      NOT NULL DEFAULT FALSE,
    popular         BOOLEAN      NOT NULL DEFAULT FALSE,
    external_id     VARCHAR(200)  UNIQUE,           -- kings-learn course ID for free enrolments
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_courses_published  ON courses (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_category   ON courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses (instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_slug       ON courses (slug);

-- ================================================================
-- 15. COURSE MODULES
-- ================================================================
CREATE TABLE IF NOT EXISTS course_modules (
    id           SERIAL PRIMARY KEY,
    course_id    INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    title        VARCHAR(300) NOT NULL,
    description  TEXT,
    module_order INTEGER      NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules (course_id, module_order);

-- ================================================================
-- 16. COURSE LESSONS
-- ================================================================
CREATE TABLE IF NOT EXISTS course_lessons (
    id           SERIAL PRIMARY KEY,
    module_id    INTEGER NOT NULL REFERENCES course_modules (id) ON DELETE CASCADE,
    title        VARCHAR(300) NOT NULL,
    description  TEXT,
    video_url    TEXT,
    duration     VARCHAR(20),                  -- e.g. "12:34"
    lesson_order INTEGER      NOT NULL DEFAULT 1,
    is_free      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON course_lessons (module_id, lesson_order);

-- ================================================================
-- 17. ENROLLMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS enrollments (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users   (id) ON DELETE CASCADE,
    course_id   INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    progress    INTEGER      NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status      VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','paused','cancelled')),
    UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user   ON enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments (course_id);

-- ================================================================
-- 18. USER LESSON PROGRESS
-- ================================================================
CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users         (id) ON DELETE CASCADE,
    lesson_id    INTEGER NOT NULL REFERENCES course_lessons (id) ON DELETE CASCADE,
    completed    BOOLEAN      NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_ulp_user   ON user_lesson_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_ulp_lesson ON user_lesson_progress (lesson_id);

-- ================================================================
-- 19. USER ACTIVITIES  (audit / timeline log)
-- ================================================================
CREATE TABLE IF NOT EXISTS user_activities (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    type        VARCHAR(50)  DEFAULT 'general',  -- 'login','project','message','enrollment'
    date        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- display timestamp (matches created_at)
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON user_activities (user_id, created_at DESC);

-- ================================================================
-- 20. AUTO-UPDATE updated_at  (trigger helper)
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables that have updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['courses','blog_posts','settings']) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_' || tbl || '_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_%I_updated_at
                 BEFORE UPDATE ON %I
                 FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
                tbl, tbl
            );
        END IF;
    END LOOP;
END;
$$;

-- ================================================================
-- 21. SEED: Default admin user
--     Password: admin123  (change immediately after first login)
--     Hash generated with bcrypt rounds=10
-- ================================================================
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES (
    'Admin',
    'admin@neurowextech.co.ke',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- 22. SEED: Default settings row  (already inserted above,
--     but repeated here for clarity if running partial scripts)
-- ================================================================
INSERT INTO settings (
    id, site_name, contact_email, whatsapp_number, location, tagline
) VALUES (
    1,
    'NeurowexTech',
    'techneurowex@gmail.com',
    '+254769329340',
    'Nairobi, Kenya',
    'We build digital products that actually ship.'
) ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- DONE — summary view
-- ================================================================
SELECT
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.columns c
     WHERE c.table_name = t.tablename AND c.table_schema = t.schemaname) AS columns
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
      'users','session','password_resets','contacts','subscribers',
      'projects','blog_posts','services','testimonials','team',
      'faqs','pricing_plans','settings',
      'courses','course_modules','course_lessons',
      'enrollments','user_lesson_progress','user_activities'
  )
ORDER BY tablename;