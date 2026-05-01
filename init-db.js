// init-db.js
require('dotenv').config();
const { Pool } = require('pg');

// Create connection to your Neon database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
        rejectUnauthorized: false  // Required for Neon
    }
});

// SQL commands to create tables
const createTablesSQL = `
-- 1. Projects / Portfolio table
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

-- 2. Contact form submissions table
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

-- 3. Blog posts table
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

-- 4. Newsletter subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. User accounts table (for future admin panel)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample project data
INSERT INTO projects (name, category, description, tech_stack, year, featured)
SELECT * FROM (VALUES 
    ('TaskFlow', 'Web App', 'Real-time task management for remote teams with drag-drop interface and team collaboration features.', ARRAY['React', 'Node.js', 'PostgreSQL', 'Socket.io'], 2024, true),
    ('FitSync', 'Mobile App', 'Workout tracking app with AI-powered form correction and personalized training plans.', ARRAY['React Native', 'Express', 'OpenAI', 'MongoDB'], 2024, true),
    ('MediBook', 'Healthcare', 'Patient appointment system with video consultation and prescription management.', ARRAY['Next.js', 'PostgreSQL', 'Tailwind', 'Twilio'], 2023, false),
    ('ShopEase', 'E-commerce', 'Multi-vendor marketplace platform with real-time inventory and analytics dashboard.', ARRAY['Vue.js', 'Django', 'PostgreSQL', 'Redis'], 2024, true),
    ('StockFlow', 'Web App', 'Inventory management system with barcode scanning and automated reordering.', ARRAY['React', 'Node.js', 'PostgreSQL', 'GraphQL'], 2023, false),
    ('ChatSphere', 'Mobile App', 'Team communication app with channels, direct messages, and file sharing.', ARRAY['Flutter', 'Firebase', 'Node.js'], 2024, true)
) AS v(name, category, description, tech_stack, year, featured)
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = v.name);

-- Insert sample blog posts
INSERT INTO blog_posts (title, slug, excerpt, author, published, published_at)
SELECT * FROM (VALUES 
    ('How to Choose Between Web and Mobile App', 'choose-web-vs-mobile', 'Decision framework for founders to pick the right platform for their idea. Consider budget, timeline, and user needs.', 'Alex Chen', true, NOW()),
    ('5 Common App Development Mistakes', 'common-dev-mistakes', 'And how to avoid them to save time and money. Learn from real project experiences.', 'Sarah Kim', true, NOW()),
    ('Why Custom Software Beats Off-the-Shelf', 'custom-vs-off-the-shelf', 'For growing businesses, custom solutions pay off in the long run. Here''s why.', 'Mike Johnson', true, NOW()),
    ('The 6-Week MVP Process', '6-week-mvp-process', 'How we take your idea from concept to working product in 6 weeks.', 'John Davis', true, NOW())
) AS v(title, slug, excerpt, author, published, published_at)
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = v.slug);
`;

// Function to run the initialization
async function initializeDatabase() {
    console.log('🚀 Starting database initialization...');
    console.log('📡 Connecting to Neon PostgreSQL...');
    
    try {
        // Test connection first
        const client = await pool.connect();
        console.log('✅ Connected to database successfully');
        client.release();
        
        // Run the SQL commands
        console.log('📝 Creating tables and inserting sample data...');
        await pool.query(createTablesSQL);
        
        console.log('✅ Database initialized successfully!');
        
        // Verify tables were created
        const tables = ['projects', 'contacts', 'blog_posts', 'subscribers', 'users'];
        console.log('\n📊 Verifying tables:');
        for (const table of tables) {
            const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`   - ${table}: ${result.rows[0].count} rows`);
        }
        
        console.log('\n✨ Setup complete! You can now run: npm run dev');
        
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
        console.error('\n🔧 Troubleshooting tips:');
        console.error('   1. Check your DATABASE_URL in .env file');
        console.error('   2. Make sure you have internet connection');
        console.error('   3. Verify Neon database is active');
    } finally {
        // Close the connection pool
        await pool.end();
    }
}

// Run the initialization
initializeDatabase();