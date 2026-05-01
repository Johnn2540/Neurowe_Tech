-- db/schema.sql
-- Run this once to set up your database

-- Projects / Portfolio table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    tech_stack TEXT[],
    image_url VARCHAR(500),
    live_demo_url VARCHAR(500),
    year INTEGER,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    project_type VARCHAR(100),
    budget VARCHAR(50),
    message TEXT,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog posts (for marketing)
CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT,
    excerpt TEXT,
    author VARCHAR(100),
    published BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO projects (name, category, description, tech_stack, year, featured)
VALUES 
    ('TaskFlow', 'Web App', 'Real-time task management for remote teams', ARRAY['React', 'Node.js', 'PostgreSQL'], 2024, true),
    ('FitSync', 'Mobile App', 'Workout tracking with AI coach', ARRAY['React Native', 'Express', 'OpenAI'], 2024, true),
    ('MediBook', 'Healthcare', 'Patient appointment system', ARRAY['Next.js', 'PostgreSQL', 'Tailwind'], 2023, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_posts (title, slug, excerpt, author, published, published_at)
VALUES 
    ('How to Choose Between Web and Mobile App', 'choose-web-vs-mobile', 'Decision framework for founders', 'Alex Chen', true, NOW()),
    ('5 Common App Development Mistakes', 'common-dev-mistakes', 'And how to avoid them', 'Sarah Kim', true, NOW())
ON CONFLICT (slug) DO NOTHING;