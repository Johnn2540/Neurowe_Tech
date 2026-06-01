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
        // Only log slow queries
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
    const { name, email, phone, project_type, budget, message, company } = contactData;
    const result = await query(
        `INSERT INTO contacts (name, email, phone, project_type, budget, message, company, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', NOW()) RETURNING *`,
        [name, email, phone || '', project_type || '', budget || '', message, company || '']
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

async function deleteContact(id) {
    const result = await query('DELETE FROM contacts WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== SUBSCRIBERS ==========
async function addSubscriber(email) {
    try {
        const result = await query(
            'INSERT INTO subscribers (email, subscribed_at) VALUES ($1, NOW()) RETURNING *',
            [email.toLowerCase()]
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

async function deleteSubscriber(id) {
    const result = await query('DELETE FROM subscribers WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== BLOG POSTS ==========
async function getBlogPosts(publishedOnly = true) {
    let sql = 'SELECT * FROM blog_posts';
    const params = [];
    
    if (publishedOnly) {
        sql += ' WHERE published = true';
    }
    
    sql += ' ORDER BY published_at DESC NULLS LAST, created_at DESC';
    
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
        'SELECT * FROM blog_posts WHERE published = true ORDER BY published_at DESC NULLS LAST LIMIT $1',
        [limit]
    );
    return result.rows;
}

async function incrementBlogView(slug) {
    await query(
        'UPDATE blog_posts SET views = COALESCE(views, 0) + 1 WHERE slug = $1',
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

// ========== TEAM MEMBERS (public) ==========
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
        INSERT INTO team (name, role, bio, linkedin_url, github_url, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
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
        const [projectsCount, contactsCount, subscribersCount] = await Promise.all([
            query('SELECT COUNT(*) FROM projects'),
            query('SELECT COUNT(*) FROM contacts'),
            query('SELECT COUNT(*) FROM subscribers')
        ]);
        
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

async function getSystemStats() {
    try {
        const [users, contacts, subscribers, projects, courses] = await Promise.all([
            query('SELECT COUNT(*) FROM users'),
            query('SELECT COUNT(*) FROM contacts'),
            query('SELECT COUNT(*) FROM subscribers'),
            query('SELECT COUNT(*) FROM projects'),
            query('SELECT COUNT(*) FROM courses WHERE published = true')
        ]);
        return {
            users: parseInt(users.rows[0].count),
            contacts: parseInt(contacts.rows[0].count),
            subscribers: parseInt(subscribers.rows[0].count),
            projects: parseInt(projects.rows[0].count),
            courses: parseInt(courses.rows[0].count)
        };
    } catch (err) {
        console.error('Error getting system stats:', err);
        return { users: 0, contacts: 0, subscribers: 0, projects: 0, courses: 0 };
    }
}

// ========== SERVICES ==========
async function getAllServices() {
    try {
        const result = await query('SELECT * FROM services ORDER BY display_order, id ASC');
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
        INSERT INTO services (name, description, icon_class, price, visible, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        RETURNING *
    `, [name, description || '', icon_class || 'fas fa-cog', price || '']);
    return result.rows[0];
}

async function deleteService(id) {
    const result = await query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== TESTIMONIALS ==========
async function getTestimonials() {
    try {
        const result = await query('SELECT * FROM testimonials WHERE published = true ORDER BY display_order, created_at DESC');
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
    const { site_name, contact_email, whatsapp_number, location, tagline } = settingsData;
    const result = await query(`
        INSERT INTO settings (id, site_name, contact_email, whatsapp_number, location, tagline, updated_at)
        VALUES (1, $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
            site_name = EXCLUDED.site_name,
            contact_email = EXCLUDED.contact_email,
            whatsapp_number = EXCLUDED.whatsapp_number,
            location = EXCLUDED.location,
            tagline = EXCLUDED.tagline,
            updated_at = NOW()
        RETURNING *
    `, [site_name || 'NeurowexTech', contact_email || 'techneurowex@gmail.com', whatsapp_number || '+254769329340', location || 'Nairobi, Kenya', tagline || '']);
    return result.rows[0];
}

// ========== FAQS ==========
async function getFAQs() {
    try {
        const result = await query('SELECT * FROM faqs WHERE active = true ORDER BY display_order, id ASC');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

async function getAllFAQs() {
    const result = await query('SELECT * FROM faqs ORDER BY display_order, id ASC');
    return result.rows;
}

async function createFAQ(faqData) {
    const { question, answer, display_order, active } = faqData;
    const result = await query(`
        INSERT INTO faqs (question, answer, display_order, active, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
    `, [question, answer, display_order || 0, active !== false]);
    return result.rows[0];
}

async function updateFAQ(id, faqData) {
    const { question, answer, display_order, active } = faqData;
    const result = await query(`
        UPDATE faqs 
        SET question = COALESCE($1, question),
            answer = COALESCE($2, answer),
            display_order = COALESCE($3, display_order),
            active = COALESCE($4, active)
        WHERE id = $5
        RETURNING *
    `, [question, answer, display_order, active, id]);
    return result.rows[0];
}

async function deleteFAQ(id) {
    const result = await query('DELETE FROM faqs WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== PRICING ==========
async function getPricingPlans() {
    try {
        const result = await query('SELECT * FROM pricing_plans ORDER BY price ASC');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

async function createPricingPlan(planData) {
    const { name, tier, price, price_label, features, popular } = planData;
    const result = await query(`
        INSERT INTO pricing_plans (name, tier, price, price_label, features, popular, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
    `, [name, tier || '', price || 0, price_label || `Kshs ${price}`, features || [], popular || false]);
    return result.rows[0];
}

async function deletePricingPlan(id) {
    const result = await query('DELETE FROM pricing_plans WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== LEARNING PLATFORM ==========

// Courses
async function getAllCourses(featuredOnly = false, publishedOnly = true) {
    let sql = `
        SELECT c.*, 
               COALESCE(u.username, '') as instructor_name,
               COALESCE((SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id), 0) as total_modules,
               COALESCE((SELECT COUNT(*) FROM course_lessons cl 
                         JOIN course_modules cm ON cl.module_id = cm.id 
                         WHERE cm.course_id = c.id), 0) as total_lessons,
               COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id), 0) as enrolled_count
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
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
    
    sql += ` ORDER BY c.featured DESC, c.created_at DESC`;
    
    const result = await query(sql, params);
    return result.rows;
}

async function getCourseById(id) {
    const result = await query(`
        SELECT c.*, 
               u.id as instructor_id,
               u.username as instructor_name,
               u.email as instructor_email
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        WHERE c.id = $1
    `, [id]);
    return result.rows[0];
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

async function getCourseModules(courseId) {
    const result = await query(`
        SELECT cm.*, 
               COALESCE(json_agg(
                   json_build_object(
                       'id', cl.id,
                       'title', cl.title,
                       'duration', cl.duration,
                       'lesson_order', cl.lesson_order,
                       'video_url', cl.video_url,
                       'is_free', cl.is_free
                   ) ORDER BY cl.lesson_order
               ) FILTER (WHERE cl.id IS NOT NULL), '[]') as lessons
        FROM course_modules cm
        LEFT JOIN course_lessons cl ON cm.id = cl.module_id
        WHERE cm.course_id = $1
        GROUP BY cm.id
        ORDER BY cm.module_order
    `, [courseId]);
    return result.rows;
}

async function createCourse(courseData) {
    const { title, slug, description, category, level, price, instructor_id, image_url, featured, published, total_duration, bestseller } = courseData;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await query(`
        INSERT INTO courses (title, slug, description, category, level, price, instructor_id, image_url, featured, published, total_duration, bestseller, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *
    `, [title, finalSlug, description || '', category || 'Web Development', level || 'Beginner', price || 0, instructor_id, image_url || '', featured || false, published !== false, total_duration || '', bestseller || false]);
    return result.rows[0];
}

async function updateCourse(id, courseData) {
    const { title, description, category, level, price, featured, published, total_duration, image_url, bestseller } = courseData;
    const result = await query(`
        UPDATE courses 
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            category = COALESCE($3, category),
            level = COALESCE($4, level),
            price = COALESCE($5, price),
            featured = COALESCE($6, featured),
            published = COALESCE($7, published),
            total_duration = COALESCE($8, total_duration),
            image_url = COALESCE($9, image_url),
            bestseller = COALESCE($10, bestseller)
        WHERE id = $11
        RETURNING *
    `, [title, description, category, level, price, featured, published, total_duration, image_url, bestseller, id]);
    return result.rows[0];
}

async function deleteCourse(id) {
    const result = await query('DELETE FROM courses WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
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

// ========== ENROLLMENTS ==========
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

async function getAllEnrollments() {
    const result = await query(`
        SELECT e.*, u.username, u.email, c.title as course_title
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        ORDER BY e.enrolled_at DESC
    `);
    return result.rows;
}

async function deleteEnrollment(id) {
    const result = await query('DELETE FROM enrollments WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== LESSON PROGRESS ==========
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

// ========== MODULES & LESSONS ==========
async function createModule(moduleData) {
    const { course_id, title, module_order, duration } = moduleData;
    const result = await query(`
        INSERT INTO course_modules (course_id, title, module_order, duration, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
    `, [course_id, title, module_order || 0, duration || '']);
    return result.rows[0];
}

async function createLesson(lessonData) {
    const { module_id, title, content, video_url, lesson_order, duration, is_free } = lessonData;
    const result = await query(`
        INSERT INTO course_lessons (module_id, title, content, video_url, lesson_order, duration, is_free, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
    `, [module_id, title, content || '', video_url || '', lesson_order || 0, duration || '', is_free || false]);
    return result.rows[0];
}

// ========== USERS ==========
async function getUserByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return result.rows[0];
}

async function getUserById(id) {
    const result = await query('SELECT id, username, email, role, is_active, created_at, last_login, google_id FROM users WHERE id = $1', [id]);
    return result.rows[0];
}

async function createUser(userData) {
    const { username, email, password_hash, role, is_active } = userData;
    const result = await query(`
        INSERT INTO users (username, email, password_hash, role, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, username, email, role
    `, [username, email.toLowerCase(), password_hash, role || 'user', is_active !== false]);
    return result.rows[0];
}

async function updateUser(id, userData) {
    const { username, email, password_hash, role, is_active, last_login } = userData;
    const result = await query(`
        UPDATE users 
        SET username = COALESCE($1, username),
            email = COALESCE($2, email),
            password_hash = COALESCE($3, password_hash),
            role = COALESCE($4, role),
            is_active = COALESCE($5, is_active),
            last_login = COALESCE($6, last_login)
        WHERE id = $7
        RETURNING id, username, email, role, is_active
    `, [username, email, password_hash, role, is_active, last_login, id]);
    return result.rows[0];
}

async function deleteUser(id) {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

async function getAllUsers() {
    const result = await query('SELECT id, username, email, role, is_active, created_at, last_login, google_id FROM users ORDER BY created_at DESC');
    return result.rows;
}

async function countUsers(filter = {}) {
    let sql = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const params = [];
    if (filter.role) {
        sql += ' AND role = $1';
        params.push(filter.role);
    }
    if (filter.is_active !== undefined) {
        sql += ` AND is_active = $${params.length + 1}`;
        params.push(filter.is_active);
    }
    const result = await query(sql, params);
    return parseInt(result.rows[0].count);
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
    deleteContact,
    
    // Subscribers
    addSubscriber,
    getAllSubscribers,
    getSubscriberCount,
    deleteSubscriber,
    
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
    getSystemStats,
    
    // FAQs
    getFAQs,
    getAllFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
    
    // Pricing
    getPricingPlans,
    createPricingPlan,
    deletePricingPlan,
    
    // Learning Platform - Courses
    getAllCourses,
    getCourseById,
    getCourseBySlug,
    getCourseModules,
    createCourse,
    updateCourse,
    deleteCourse,
    getCourseStats,
    getCourseCategories,
    
    // Learning Platform - Enrollments
    getEnrollment,
    createEnrollment,
    updateEnrollmentProgress,
    getUserEnrollments,
    getAllEnrollments,
    deleteEnrollment,
    
    // Learning Platform - Lessons
    markLessonComplete,
    getLessonProgress,
    getUserCourseProgress,
    
    // Learning Platform - Modules & Lessons
    createModule,
    createLesson,
    
    // Users
    getUserByEmail,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getAllUsers,
    countUsers,
};