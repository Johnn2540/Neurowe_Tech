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

// Create connection pool optimized for Vercel serverless
const pool = new Pool({
    connectionString: connectionString,
    ssl: { 
        rejectUnauthorized: false 
    },
    max: 1,                    // Vercel serverless: only 1 connection per instance
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,     // Allow process to exit when idle
});

// Test the connection (skip detailed logging on Vercel)
async function testConnection() {
    // Skip heavy logging on Vercel to avoid timeouts
    if (process.env.VERCEL === '1') {
        console.log('✅ Vercel environment - database connection ready');
        return true;
    }
    
    try {
        console.log('⏳ Testing database connection...');
        const client = await pool.connect();
        console.log('✅ PostgreSQL Connected Successfully to Neon');
        
        // Lightweight test query
        const result = await client.query('SELECT NOW()');
        console.log(`📅 Database time: ${result.rows[0].now}`);
        
        client.release();
        return true;
    } catch (err) {
        console.error('❌ PostgreSQL Connection Error:', err.message);
        return false;
    }
}

// Run the connection test (non-blocking on Vercel)
if (process.env.VERCEL !== '1') {
    testConnection();
} else {
    // Just log that we're ready on Vercel
    console.log('🚀 Vercel serverless mode - database pool ready');
}

// Helper function for queries with logging
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Only log slow queries in production
        if (duration > 1000) {
            console.log(`⚠️ Slow query (${duration}ms):`, text.substring(0, 50));
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

// ========== ADMIN BLOG POSTS ==========
async function getAllBlogPosts() {
    const result = await query(`
        SELECT id, title, slug, category, author, excerpt, published, created_at
        FROM blog_posts
        ORDER BY created_at DESC
    `);
    return result.rows;
}

async function createBlogPost(postData) {
    const { title, slug, category, author, excerpt, external_url, published } = postData;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await query(`
        INSERT INTO blog_posts (title, slug, category, author, excerpt, external_url, published, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
    `, [title, finalSlug, category || 'General', author || 'Admin', excerpt || '', external_url || '', published || false]);
    
    return result.rows[0];
}

async function deleteBlogPost(id) {
    const result = await query('DELETE FROM blog_posts WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== TEAM MEMBERS ==========
async function getTeamMembers() {
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

// ========== ADMIN TEAM ==========
async function getAllTeamMembers() {
    const result = await query('SELECT * FROM team ORDER BY id ASC');
    return result.rows;
}

async function createTeamMember(teamData) {
    const { name, role, bio, linkedin_url, github_url } = teamData;
    const result = await query(`
        INSERT INTO team (name, role, bio, linkedin_url, github_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [name, role, bio || '', linkedin_url || '', github_url || '']);
    return result.rows[0];
}

async function deleteTeamMember(id) {
    const result = await query('DELETE FROM team WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
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
    try {
        const result = await query('SELECT * FROM services ORDER BY display_order');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

// ========== ADMIN SERVICES ==========
async function getAllServicesAdmin() {
    const result = await query('SELECT * FROM services ORDER BY id ASC');
    return result.rows;
}

async function createService(serviceData) {
    const { name, description, icon_class, price } = serviceData;
    const result = await query(`
        INSERT INTO services (name, description, icon_class, price, visible)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
    `, [name, description || '', icon_class || '', price || '']);
    return result.rows[0];
}

async function deleteService(id) {
    const result = await query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== TESTIMONIALS ==========
async function getTestimonials() {
    try {
        const result = await query('SELECT * FROM testimonials WHERE published = true ORDER BY display_order');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

// ========== ADMIN TESTIMONIALS ==========
async function getAllTestimonials() {
    const result = await query('SELECT * FROM testimonials ORDER BY created_at DESC');
    return result.rows;
}

async function createTestimonial(testimonialData) {
    const { client_name, client_role, company, rating, content } = testimonialData;
    const result = await query(`
        INSERT INTO testimonials (client_name, client_role, company, rating, content, published, created_at)
        VALUES ($1, $2, $3, $4, $5, true, NOW())
        RETURNING *
    `, [client_name, client_role || '', company || '', rating || 5, content]);
    return result.rows[0];
}

async function deleteTestimonial(id) {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== ADMIN SETTINGS ==========
async function getSettings() {
    const result = await query('SELECT * FROM settings LIMIT 1');
    return result.rows[0] || {};
}

async function updateSettings(settingsData) {
    const { site_name, contact_email, whatsapp_number, location } = settingsData;
    const result = await query(`
        INSERT INTO settings (id, site_name, contact_email, whatsapp_number, location, updated_at)
        VALUES (1, $1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
            site_name = EXCLUDED.site_name,
            contact_email = EXCLUDED.contact_email,
            whatsapp_number = EXCLUDED.whatsapp_number,
            location = EXCLUDED.location,
            updated_at = NOW()
        RETURNING *
    `, [site_name || 'Neurowex Tech', contact_email || '', whatsapp_number || '', location || '']);
    return result.rows[0];
}

// ========== FAQS ==========
async function getFAQs() {
    try {
        const result = await query('SELECT * FROM faqs WHERE published = true ORDER BY display_order');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

// ========== LEARNING PLATFORM ==========

// Courses
async function getAllCourses(featuredOnly = false, publishedOnly = true) {
    let sql = `
        SELECT c.*, 
               u.username as instructor_name,
               COUNT(DISTINCT cm.id) as total_modules,
               COUNT(DISTINCT cl.id) as total_lessons
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN course_modules cm ON c.id = cm.course_id
        LEFT JOIN course_lessons cl ON cm.id = cl.module_id
    `;
    const params = [];
    const conditions = [];
    
    if (publishedOnly) {
        conditions.push(`c.published = true`);
    }
    
    if (featuredOnly) {
        conditions.push(`c.featured = true`);
    }
    
    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    sql += ` GROUP BY c.id, u.username ORDER BY c.featured DESC, c.created_at DESC`;
    
    const result = await query(sql, params);
    return result.rows;
}

async function getCourseById(id) {
    const result = await query(`
        SELECT c.*, 
               u.username as instructor_name,
               u.email as instructor_email
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        WHERE c.id = $1
    `, [id]);
    return result.rows[0];
}

async function getCourseModules(courseId) {
    const result = await query(`
        SELECT cm.*, 
               json_agg(
                   json_build_object(
                       'id', cl.id,
                       'title', cl.title,
                       'duration', cl.duration,
                       'lesson_order', cl.lesson_order,
                       'video_url', cl.video_url,
                       'is_free', cl.is_free
                   ) ORDER BY cl.lesson_order
               ) as lessons
        FROM course_modules cm
        LEFT JOIN course_lessons cl ON cm.id = cl.module_id
        WHERE cm.course_id = $1
        GROUP BY cm.id
        ORDER BY cm.module_order
    `, [courseId]);
    return result.rows;
}

async function getCourseBySlug(slug) {
    const result = await query(`
        SELECT c.*, u.username as instructor_name
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        WHERE c.slug = $1 AND c.published = true
    `, [slug]);
    return result.rows[0];
}

async function getEnrollment(userId, courseId) {
    const result = await query(`
        SELECT * FROM enrollments 
        WHERE user_id = $1 AND course_id = $2
    `, [userId, courseId]);
    return result.rows[0];
}

async function createEnrollment(userId, courseId) {
    const result = await query(`
        INSERT INTO enrollments (user_id, course_id, enrolled_at, progress, status)
        VALUES ($1, $2, NOW(), 0, 'active')
        RETURNING *
    `, [userId, courseId]);
    return result.rows[0];
}

async function updateEnrollmentProgress(enrollmentId, progress) {
    const result = await query(`
        UPDATE enrollments 
        SET progress = $1
        WHERE id = $2
        RETURNING *
    `, [progress, enrollmentId]);
    return result.rows[0];
}

async function getUserEnrollments(userId) {
    const result = await query(`
        SELECT e.*, c.title, c.category, c.level, c.image_url, c.instructor_id,
               u.username as instructor_name,
               (SELECT COUNT(*) FROM course_lessons cl 
                JOIN course_modules cm ON cl.module_id = cm.id 
                WHERE cm.course_id = c.id) as total_lessons,
               (SELECT COUNT(*) FROM user_lesson_progress ulp 
                JOIN course_lessons cl ON ulp.lesson_id = cl.id
                JOIN course_modules cm ON cl.module_id = cm.id
                WHERE cm.course_id = c.id AND ulp.user_id = $1 AND ulp.completed = true) as completed_lessons
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        WHERE e.user_id = $1
        ORDER BY e.enrolled_at DESC
    `, [userId]);
    return result.rows;
}

async function markLessonComplete(userId, lessonId) {
    const result = await query(`
        INSERT INTO user_lesson_progress (user_id, lesson_id, completed, completed_at)
        VALUES ($1, $2, true, NOW())
        ON CONFLICT (user_id, lesson_id) 
        DO UPDATE SET completed = true, completed_at = NOW()
        RETURNING *
    `, [userId, lessonId]);
    return result.rows[0];
}

async function getLessonProgress(userId, lessonId) {
    const result = await query(`
        SELECT * FROM user_lesson_progress 
        WHERE user_id = $1 AND lesson_id = $2
    `, [userId, lessonId]);
    return result.rows[0];
}

async function getUserCourseProgress(userId, courseId) {
    const result = await query(`
        SELECT 
            COUNT(DISTINCT cl.id) as total_lessons,
            COUNT(DISTINCT CASE WHEN ulp.completed = true THEN cl.id END) as completed_lessons
        FROM courses c
        JOIN course_modules cm ON c.id = cm.course_id
        JOIN course_lessons cl ON cm.id = cl.module_id
        LEFT JOIN user_lesson_progress ulp ON cl.id = ulp.lesson_id AND ulp.user_id = $1
        WHERE c.id = $2
        GROUP BY c.id
    `, [userId, courseId]);
    
    if (result.rows.length === 0) {
        return { total_lessons: 0, completed_lessons: 0 };
    }
    return result.rows[0];
}

async function getCourseCategories() {
    const result = await query(`
        SELECT category, COUNT(*) as course_count
        FROM courses
        WHERE published = true
        GROUP BY category
        ORDER BY category
    `);
    return result.rows;
}

async function getCourseStats() {
    const result = await query(`
        SELECT 
            (SELECT COUNT(*) FROM courses WHERE published = true) as total_courses,
            (SELECT COUNT(DISTINCT category) FROM courses WHERE published = true) as total_categories,
            (SELECT COUNT(*) FROM enrollments) as total_enrollments,
            (SELECT COUNT(DISTINCT instructor_id) FROM courses WHERE published = true) as total_instructors
    `);
    return result.rows[0];
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
    
    // Blog (public)
    getBlogPosts,
    getBlogPostBySlug,
    getRecentBlogPosts,
    incrementBlogView,
    
    // Blog (admin)
    getAllBlogPosts,
    createBlogPost,
    deleteBlogPost,
    
    // Team (public)
    getTeamMembers,
    
    // Team (admin)
    getAllTeamMembers,
    createTeamMember,
    deleteTeamMember,
    
    // Services (public)
    getAllServices,
    
    // Services (admin)
    getAllServicesAdmin,
    createService,
    deleteService,
    
    // Testimonials (public)
    getTestimonials,
    
    // Testimonials (admin)
    getAllTestimonials,
    createTestimonial,
    deleteTestimonial,
    
    // Settings (admin)
    getSettings,
    updateSettings,
    
    // Stats
    getStats,
    
    // FAQs
    getFAQs,
    
    // Learning Platform
    getAllCourses,
    getCourseById,
    getCourseBySlug,
    getCourseModules,
    getEnrollment,
    createEnrollment,
    updateEnrollmentProgress,
    getUserEnrollments,
    markLessonComplete,
    getLessonProgress,
    getUserCourseProgress,
    getCourseCategories,
    getCourseStats,
};