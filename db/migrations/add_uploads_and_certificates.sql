-- ============================================================
-- NeurowexTech — Uploads & Certificates Migration
-- Run this script in Neon (SQL editor)
-- ============================================================

-- 1. Add Cloudinary storage columns to course_lessons
ALTER TABLE course_lessons
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url        TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name       TEXT,
  ADD COLUMN IF NOT EXISTS attachment_public_id  TEXT;

-- 2. Add certificate_enabled flag to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Create course_certificates table
CREATE TABLE IF NOT EXISTS course_certificates (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id             INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    issued_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    certificate_url       TEXT NOT NULL,
    certificate_public_id TEXT,
    issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_user    ON course_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_course  ON course_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_cc_issued  ON course_certificates(issued_at DESC);
