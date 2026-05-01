// db/postgres.js
const { Pool } = require('pg');
require('dotenv').config();

// Log the connection string (without password for security)
const connectionString = process.env.DATABASE_URL;
console.log('📡 Attempting to connect to PostgreSQL...');
console.log('🔗 Connection string exists:', !!connectionString);

if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in .env file');
    process.exit(1);
}

// Create connection pool with more detailed error handling
const pool = new Pool({
    connectionString: connectionString,
    ssl: { 
        rejectUnauthorized: false 
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test the connection with better error logging
async function testConnection() {
    try {
        console.log('⏳ Testing database connection...');
        const client = await pool.connect();
        console.log('✅ PostgreSQL Connected Successfully to Neon');
        
        // Test query to verify tables exist
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        console.log(`📊 Tables found: ${result.rows.map(r => r.table_name).join(', ')}`);
        
        // Count projects
        const projectsCount = await client.query('SELECT COUNT(*) FROM projects');
        console.log(`📊 Projects table has ${projectsCount.rows[0].count} rows`);
        
        client.release();
        return true;
    } catch (err) {
        console.error('❌ PostgreSQL Connection Error:', err.message);
        console.error('📋 Error details:', err.stack);
        
        // Common troubleshooting tips
        if (err.message.includes('password authentication failed')) {
            console.error('\n🔧 FIX: Wrong password in DATABASE_URL');
            console.error('   Get a fresh connection string from Neon dashboard');
        } else if (err.message.includes('does not exist')) {
            console.error('\n🔧 FIX: Database name is incorrect');
            console.error('   Check your DATABASE_URL includes the correct database name');
        } else if (err.message.includes('timeout')) {
            console.error('\n🔧 FIX: Connection timeout - check your internet');
            console.error('   Try reconnecting or check if Neon is down');
        } else if (err.message.includes('getaddrinfo')) {
            console.error('\n🔧 FIX: Cannot resolve hostname - check your internet');
            console.error('   Make sure you can reach neon.tech');
        } else if (err.message.includes('relation') && err.message.includes('does not exist')) {
            console.error('\n🔧 FIX: Tables not created. Run the schema.sql in Neon SQL Editor');
        }
        
        return false;
    }
}

// Run the connection test
testConnection();

// Helper function for queries with logging
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV !== 'production') {
            console.log('📝 Executed query:', { 
                text: text.substring(0, 50), 
                duration, 
                rows: res.rowCount 
            });
        }
        return res;
    } catch (err) {
        console.error('❌ Query error:', err.message);
        console.error('Failed query:', text.substring(0, 100));
        throw err;
    }
}

// ========== PROJECTS ==========
async function getAllProjects(featuredOnly = false) {
    let sql = 'SELECT * FROM projects';
    const params = [];
    
    if (featuredOnly) {
        sql += ' WHERE featured = true';
    }
    
    sql += ' ORDER BY year DESC, created_at DESC';
    
    const result = await query(sql, params);
    return result.rows;
}

async function getProjectById(id) {
    const result = await query('SELECT * FROM projects WHERE id = $1', [id]);
    return result.rows[0];
}

async function getProjectsByCategory(category) {
    const result = await query(
        'SELECT * FROM projects WHERE category = $1 ORDER BY year DESC',
        [category]
    );
    return result.rows;
}

async function getRecentProjects(limit = 6) {
    const result = await query(
        'SELECT * FROM projects ORDER BY created_at DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

// ========== CONTACTS ==========
async function saveContact(contactData) {
    const { name, email, phone, project_type, budget, message } = contactData;
    const result = await query(
        `INSERT INTO contacts (name, email, phone, project_type, budget, message, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'new') RETURNING *`,
        [name, email, phone, project_type, budget, message]
    );
    return result.rows[0];
}

async function getAllContacts(limit = 50) {
    const result = await query(
        'SELECT * FROM contacts ORDER BY created_at DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

async function updateContactStatus(id, status) {
    const result = await query(
        'UPDATE contacts SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
    );
    return result.rows[0];
}

// ========== SUBSCRIBERS ==========
async function addSubscriber(email) {
    try {
        const result = await query(
            'INSERT INTO subscribers (email) VALUES ($1) RETURNING *',
            [email]
        );
        return result.rows[0];
    } catch (err) {
        if (err.code === '23505') {
            throw new Error('Email already subscribed');
        }
        throw err;
    }
}

async function getAllSubscribers() {
    const result = await query('SELECT * FROM subscribers ORDER BY subscribed_at DESC');
    return result.rows;
}

async function getSubscriberCount() {
    const result = await query('SELECT COUNT(*) FROM subscribers');
    return parseInt(result.rows[0].count);
}

// ========== BLOG POSTS ==========
async function getBlogPosts(publishedOnly = true) {
    let sql = 'SELECT * FROM blog_posts';
    const params = [];
    
    if (publishedOnly) {
        sql += ' WHERE published = true';
    }
    
    sql += ' ORDER BY published_at DESC NULLS LAST';
    
    const result = await query(sql, params);
    return result.rows;
}

async function getBlogPostBySlug(slug) {
    const result = await query(
        'SELECT * FROM blog_posts WHERE slug = $1 AND published = true',
        [slug]
    );
    return result.rows[0];
}

async function getRecentBlogPosts(limit = 3) {
    const result = await query(
        'SELECT * FROM blog_posts WHERE published = true ORDER BY published_at DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

async function incrementBlogView(slug) {
    await query(
        'UPDATE blog_posts SET views = views + 1 WHERE slug = $1',
        [slug]
    );
}

// ========== TEAM MEMBERS ==========
async function getTeamMembers() {
    // Check if team_members table exists, if not return empty array
    try {
        const result = await query(
            'SELECT * FROM team_members ORDER BY display_order, created_at'
        );
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            console.log('⚠️ team_members table not found - returning empty array');
            return [];
        }
        throw err;
    }
}

// ========== STATISTICS ==========
async function getStats() {
    try {
        const projectsCount = await query('SELECT COUNT(*) FROM projects');
        const contactsCount = await query('SELECT COUNT(*) FROM contacts');
        const subscribersCount = await query('SELECT COUNT(*) FROM subscribers');
        
        return {
            projects: parseInt(projectsCount.rows[0].count),
            contacts: parseInt(contactsCount.rows[0].count),
            subscribers: parseInt(subscribersCount.rows[0].count)
        };
    } catch (err) {
        console.error('Error getting stats:', err);
        return { projects: 0, contacts: 0, subscribers: 0 };
    }
}

// ========== SERVICES ==========
async function getAllServices() {
    // You can create a services table or return static data
    // For now, return empty array (will use static fallback)
    try {
        const result = await query('SELECT * FROM services ORDER BY display_order');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return []; // No services table yet
        }
        throw err;
    }
}

// ========== TESTIMONIALS ==========
async function getTestimonials() {
    try {
        const result = await query('SELECT * FROM testimonials WHERE published = true ORDER BY display_order');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return []; // No testimonials table yet
        }
        throw err;
    }
}

// ========== FAQS ==========
async function getFAQs() {
    try {
        const result = await query('SELECT * FROM faqs WHERE published = true ORDER BY display_order');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return []; // No faqs table yet
        }
        throw err;
    }
}

// ========== EXPORT ALL FUNCTIONS ==========
module.exports = {
    // Connection
    query,
    pool,
    testConnection,
    
    // Projects
    getAllProjects,
    getProjectById,
    getProjectsByCategory,
    getRecentProjects,
    
    // Contacts
    saveContact,
    getAllContacts,
    updateContactStatus,
    
    // Subscribers
    addSubscriber,
    getAllSubscribers,
    getSubscriberCount,
    
    // Blog
    getBlogPosts,
    getBlogPostBySlug,
    getRecentBlogPosts,
    incrementBlogView,
    
    // Team
    getTeamMembers,
    
    // Stats
    getStats,
    
    // Services
    getAllServices,
    
    // Testimonials
    getTestimonials,
    
    // FAQs
    getFAQs
};