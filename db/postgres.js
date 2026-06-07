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

// Create connection pool optimized for Neon PostgreSQL on Vercel
const pool = new Pool({
    connectionString: connectionString,
    ssl: { 
        rejectUnauthorized: false 
    },
    max: process.env.VERCEL === '1' ? 2 : 20,     // Increased from 1 to 2 for Vercel
    idleTimeoutMillis: 60000,                      // Increased from 30s to 60s
    connectionTimeoutMillis: 30000,                // Increased from 10s to 30s
    allowExitOnIdle: true,
    maxUses: 7500,
    // Add these critical settings for Neon
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

// Connection health monitoring
let lastHealthCheck = Date.now();
let isHealthy = true;

async function checkConnectionHealth() {
    try {
        // Only check every 30 seconds
        if (Date.now() - lastHealthCheck < 30000) return true;
        
        const result = await pool.query('SELECT 1 as health');
        if (result.rows[0]?.health === 1) {
            if (!isHealthy) {
                console.log('✅ Database connection restored');
                isHealthy = true;
            }
            lastHealthCheck = Date.now();
            return true;
        }
    } catch (err) {
        if (isHealthy) {
            console.error('❌ Database connection unhealthy:', err.message);
            isHealthy = false;
        }
        return false;
    }
}

// Run health check periodically (skip on Vercel to avoid extra load)
if (process.env.VERCEL !== '1') {
    setInterval(checkConnectionHealth, 30000);
}

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

// Helper function for queries with logging, timeout, and retry logic
async function query(text, params, timeout = 30000) {
    const start = Date.now();
    let client;
    let retries = 2;
    
    while (retries >= 0) {
        try {
            client = await pool.connect();
            
            // Set statement and lock timeouts
            await client.query(`SET statement_timeout = ${timeout}`);
            await client.query(`SET lock_timeout = '10000'`); // 10 second lock timeout
            
            const res = await client.query(text, params);
            const duration = Date.now() - start;
            
            // Log slow queries with more detail
            if (duration > 3000) {
                console.log(`⚠️ Very slow query (${duration}ms): ${text.substring(0, 100)}`);
            } else if (duration > 1000) {
                console.log(`⚠️ Slow query (${duration}ms): ${text.substring(0, 100)}`);
            } else if (duration > 500) {
                console.log(`⌛ Moderate query (${duration}ms): ${text.substring(0, 80)}`);
            }
            
            client.release();
            return res;
            
        } catch (err) {
            if (client) {
                try { client.release(); } catch(e) {}
            }
            
            // Retry on connection errors
            if (retries > 0 && (err.code === 'ECONNRESET' || 
                err.code === '57P01' || // admin_shutdown
                err.message.includes('timeout') || 
                err.message.includes('terminated') ||
                err.message.includes('connection lost'))) {
                
                console.log(`🔄 Query retry (${retries} left): ${text.substring(0, 80)}`);
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            console.error('❌ Query error:', err.message);
            console.error('Failed query:', text.substring(0, 200));
            throw err;
        }
    }
}

// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
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

async function createProject(projectData) {
    const { name, description, category, year, featured, client_url, tech_stack, image_url, user_id } = projectData;
    const result = await query(`
        INSERT INTO projects (name, description, category, year, featured, client_url, tech_stack, image_url, user_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
    `, [name, description || '', category || 'Web', year || new Date().getFullYear(), featured || false, client_url || '', tech_stack || '', image_url || '', user_id || null]);
    return result.rows[0];
}

async function updateProject(id, projectData) {
    const { name, description, category, year, featured, client_url, tech_stack, image_url } = projectData;
    const result = await query(`
        UPDATE projects 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            category = COALESCE($3, category),
            year = COALESCE($4, year),
            featured = COALESCE($5, featured),
            client_url = COALESCE($6, client_url),
            tech_stack = COALESCE($7, tech_stack),
            image_url = COALESCE($8, image_url),
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
    `, [name, description, category, year, featured, client_url, tech_stack, image_url, id]);
    return result.rows[0];
}

async function deleteProject(id) {
    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
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

async function getAllContacts(limit = 100, offset = 0) {
    const result = await query(
        'SELECT * FROM contacts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    return result.rows;
}

async function getUnreadContactsCount() {
    const result = await query(
        "SELECT COUNT(*) FROM contacts WHERE status = 'new' OR status IS NULL"
    );
    return parseInt(result.rows[0].count);
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

async function getAllSubscribers(limit = 100) {
    const result = await query('SELECT * FROM subscribers ORDER BY subscribed_at DESC LIMIT $1', [limit]);
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
async function getBlogPosts(publishedOnly = true, limit = 50) {
    let sql = 'SELECT * FROM blog_posts';
    const params = [];
    let paramIndex = 1;
    
    if (publishedOnly) {
        sql += ' WHERE published = true';
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
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
        'SELECT * FROM blog_posts WHERE published = true ORDER BY created_at DESC LIMIT $1',
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

async function getBlogCategories() {
    const result = await query(`
        SELECT category, COUNT(*) as count 
        FROM blog_posts 
        WHERE published = true 
        GROUP BY category 
        ORDER BY count DESC
    `);
    return result.rows;
}

// ========== ADMIN BLOG POSTS ==========
async function getAllBlogPostsAdmin(limit = 100, offset = 0) {
    const result = await query(`
        SELECT id, title, slug, category, author, excerpt, published, created_at, views
        FROM blog_posts
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
}

async function getBlogPostById(id) {
    const result = await query('SELECT * FROM blog_posts WHERE id = $1', [id]);
    return result.rows[0];
}

async function createBlogPost(postData) {
    const { title, slug, category, author, excerpt, content, external_url, image_url, published, read_time } = postData;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await query(`
        INSERT INTO blog_posts (title, slug, category, author, excerpt, content, external_url, image_url, published, read_time, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
    `, [title, finalSlug, category || 'General', author || 'Admin', excerpt || '', content || '', external_url || '', image_url || '', published || false, read_time || 5]);
    
    return result.rows[0];
}

async function updateBlogPost(id, postData) {
    const { title, slug, category, author, excerpt, content, external_url, image_url, published, read_time } = postData;
    const result = await query(`
        UPDATE blog_posts 
        SET title = COALESCE($1, title),
            slug = COALESCE($2, slug),
            category = COALESCE($3, category),
            author = COALESCE($4, author),
            excerpt = COALESCE($5, excerpt),
            content = COALESCE($6, content),
            external_url = COALESCE($7, external_url),
            image_url = COALESCE($8, image_url),
            published = COALESCE($9, published),
            read_time = COALESCE($10, read_time),
            updated_at = NOW()
        WHERE id = $11
        RETURNING *
    `, [title, slug, category, author, excerpt, content, external_url, image_url, published, read_time, id]);
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
            'SELECT * FROM team ORDER BY display_order, id ASC'
        );
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            console.log('⚠️ team table not found - returning empty array');
            return [];
        }
        throw err;
    }
}

async function getAllTeamMembers() {
    const result = await query('SELECT * FROM team ORDER BY id ASC');
    return result.rows;
}

async function getTeamMemberById(id) {
    const result = await query('SELECT * FROM team WHERE id = $1', [id]);
    return result.rows[0];
}

async function createTeamMember(teamData) {
    const { name, role, bio, linkedin_url, github_url, twitter_url, image_url, display_order } = teamData;
    const result = await query(`
        INSERT INTO team (name, role, bio, linkedin_url, github_url, twitter_url, image_url, display_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
    `, [name, role, bio || '', linkedin_url || '', github_url || '', twitter_url || '', image_url || '', display_order || 0]);
    return result.rows[0];
}

async function updateTeamMember(id, teamData) {
    const { name, role, bio, linkedin_url, github_url, twitter_url, image_url, display_order } = teamData;
    const result = await query(`
        UPDATE team 
        SET name = COALESCE($1, name),
            role = COALESCE($2, role),
            bio = COALESCE($3, bio),
            linkedin_url = COALESCE($4, linkedin_url),
            github_url = COALESCE($5, github_url),
            twitter_url = COALESCE($6, twitter_url),
            image_url = COALESCE($7, image_url),
            display_order = COALESCE($8, display_order),
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
    `, [name, role, bio, linkedin_url, github_url, twitter_url, image_url, display_order, id]);
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
        // Use parallel queries but with individual timeouts and error handling
        const stats = {};
        
        // Run each query with its own timeout to prevent one from blocking others
        const promises = [
            { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
            { name: 'contacts', query: 'SELECT COUNT(*) as count FROM contacts' },
            { name: 'subscribers', query: 'SELECT COUNT(*) as count FROM subscribers' },
            { name: 'projects', query: 'SELECT COUNT(*) as count FROM projects' },
            { name: 'courses', query: 'SELECT COUNT(*) as count FROM courses WHERE published = true' }
        ];
        
        const results = await Promise.allSettled(
            promises.map(p => query(p.query, [], 10000).catch(err => {
                console.error(`Failed to get ${p.name} count:`, err.message);
                return { rows: [{ count: 0 }] };
            }))
        );
        
        promises.forEach((p, index) => {
            const result = results[index];
            if (result.status === 'fulfilled' && result.value?.rows[0]) {
                stats[p.name] = parseInt(result.value.rows[0].count) || 0;
            } else {
                stats[p.name] = 0;
            }
        });
        
        return stats;
    } catch (err) {
        console.error('Error getting system stats:', err);
        return { users: 0, contacts: 0, subscribers: 0, projects: 0, courses: 0 };
    }
}

// ========== SERVICES ==========
async function getAllServices() {
    try {
        const result = await query('SELECT * FROM services WHERE visible = true ORDER BY display_order, id ASC');
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

async function getAllServicesAdmin() {
    const result = await query('SELECT * FROM services ORDER BY id ASC');
    return result.rows;
}

async function createService(serviceData) {
    const { name, description, icon_class, price, display_order, visible } = serviceData;
    const result = await query(`
        INSERT INTO services (name, description, icon_class, price, display_order, visible, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
    `, [name, description || '', icon_class || 'fas fa-cog', price || '', display_order || 0, visible !== false]);
    return result.rows[0];
}

async function updateService(id, serviceData) {
    const { name, description, icon_class, price, display_order, visible } = serviceData;
    const result = await query(`
        UPDATE services 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            icon_class = COALESCE($3, icon_class),
            price = COALESCE($4, price),
            display_order = COALESCE($5, display_order),
            visible = COALESCE($6, visible),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
    `, [name, description, icon_class, price, display_order, visible, id]);
    return result.rows[0];
}

async function deleteService(id) {
    const result = await query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== TESTIMONIALS ==========
async function getTestimonials(limit = 6) {
    try {
        const result = await query(`
            SELECT * FROM testimonials 
            WHERE published = true 
            ORDER BY display_order, created_at DESC 
            LIMIT $1
        `, [limit]);
        return result.rows;
    } catch (err) {
        if (err.message.includes('relation') && err.message.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

async function getAllTestimonials() {
    const result = await query('SELECT * FROM testimonials ORDER BY created_at DESC');
    return result.rows;
}

async function createTestimonial(testimonialData) {
    const { client_name, client_role, company, rating, content, display_order, published } = testimonialData;
    const result = await query(`
        INSERT INTO testimonials (client_name, client_role, company, rating, content, display_order, published, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
    `, [client_name, client_role || '', company || '', rating || 5, content, display_order || 0, published !== false]);
    return result.rows[0];
}

async function updateTestimonial(id, testimonialData) {
    const { client_name, client_role, company, rating, content, display_order, published } = testimonialData;
    const result = await query(`
        UPDATE testimonials 
        SET client_name = COALESCE($1, client_name),
            client_role = COALESCE($2, client_role),
            company = COALESCE($3, company),
            rating = COALESCE($4, rating),
            content = COALESCE($5, content),
            display_order = COALESCE($6, display_order),
            published = COALESCE($7, published),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
    `, [client_name, client_role, company, rating, content, display_order, published, id]);
    return result.rows[0];
}

async function deleteTestimonial(id) {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== SETTINGS ==========
async function getSettings() {
    const result = await query('SELECT * FROM settings LIMIT 1');
    return result.rows[0] || {};
}

async function updateSettings(settingsData) {
    const { site_name, contact_email, whatsapp_number, location, tagline, logo_url, favicon_url, meta_description } = settingsData;
    const result = await query(`
        INSERT INTO settings (id, site_name, contact_email, whatsapp_number, location, tagline, logo_url, favicon_url, meta_description, updated_at)
        VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
            site_name = EXCLUDED.site_name,
            contact_email = EXCLUDED.contact_email,
            whatsapp_number = EXCLUDED.whatsapp_number,
            location = EXCLUDED.location,
            tagline = EXCLUDED.tagline,
            logo_url = EXCLUDED.logo_url,
            favicon_url = EXCLUDED.favicon_url,
            meta_description = EXCLUDED.meta_description,
            updated_at = NOW()
        RETURNING *
    `, [site_name || 'NeurowexTech', contact_email || 'techneurowex@gmail.com', whatsapp_number || '+254769329340', location || 'Nairobi, Kenya', tagline || '', logo_url || '', favicon_url || '', meta_description || '']);
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
            active = COALESCE($4, active),
            updated_at = NOW()
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

async function getAllPricingPlans() {
    const result = await query('SELECT * FROM pricing_plans ORDER BY price ASC');
    return result.rows;
}

async function createPricingPlan(planData) {
    const { name, tier, price, price_label, features, popular, display_order } = planData;
    const featuresArr = Array.isArray(features) ? features : (features ? String(features).split('\n').filter(Boolean) : []);
    const result = await query(`
        INSERT INTO pricing_plans (name, tier, price, price_label, features, popular, display_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
    `, [name, tier || '', parseFloat(price) || 0, price_label || `Kshs ${price}`, JSON.stringify(featuresArr), popular || false, display_order || 0]);
    return result.rows[0];
}

async function updatePricingPlan(id, planData) {
    const { name, tier, price, price_label, features, popular, display_order } = planData;
    const featuresArr = Array.isArray(features) ? features : (features ? String(features).split('\n').filter(Boolean) : []);
    const result = await query(`
        UPDATE pricing_plans 
        SET name = COALESCE($1, name),
            tier = COALESCE($2, tier),
            price = COALESCE($3, price),
            price_label = COALESCE($4, price_label),
            features = COALESCE($5, features),
            popular = COALESCE($6, popular),
            display_order = COALESCE($7, display_order),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
    `, [name, tier, price, price_label, JSON.stringify(featuresArr), popular, display_order, id]);
    return result.rows[0];
}

async function deletePricingPlan(id) {
    const result = await query('DELETE FROM pricing_plans WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

// ========== LEARNING PLATFORM ==========

// Courses
async function getAllCourses(featuredOnly = false, publishedOnly = true, limit = 50) {
    let sql = `
        SELECT c.*, 
               COALESCE(u.username, 'NeurowexTech') as instructor_name,
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
    let paramIndex = 1;
    
    if (publishedOnly) {
        conditions.push(`c.published = true`);
    }
    
    if (featuredOnly) {
        conditions.push(`c.featured = true`);
    }
    
    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    sql += ` ORDER BY c.featured DESC, c.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await query(sql, params);
    return result.rows;
}

async function getCourseById(id) {
    const result = await query(`
        SELECT c.*, 
               u.id as instructor_id,
               u.username as instructor_name,
               u.email as instructor_email,
               COALESCE(e.enrolled_count, 0) as total_enrolled
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN (
            SELECT course_id, COUNT(*) as enrolled_count
            FROM enrollments
            GROUP BY course_id
        ) e ON c.id = e.course_id
        WHERE c.id = $1
    `, [id]);
    return result.rows[0];
}

async function getCourseBySlug(slug) {
    const result = await query(`
        SELECT c.*, u.username as instructor_name,
               COALESCE(e.enrolled_count, 0) as total_enrolled
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN (
            SELECT course_id, COUNT(*) as enrolled_count
            FROM enrollments
            GROUP BY course_id
        ) e ON c.id = e.course_id
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
    const { title, slug, description, category, level, price, instructor_id, image_url, featured, published, total_duration, bestseller, external_id } = courseData;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await query(`
        INSERT INTO courses (title, slug, description, category, level, price, instructor_id, image_url, featured, published, total_duration, bestseller, external_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *
    `, [title, finalSlug, description || '', category || 'Web Development', level || 'Beginner', price || 0, instructor_id, image_url || '/images/course-placeholder.jpg', featured || false, published !== false, total_duration || '4 weeks', bestseller || false, external_id || null]);
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
            bestseller = COALESCE($10, bestseller),
            updated_at = NOW()
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
            (SELECT COUNT(DISTINCT instructor_id) FROM courses WHERE published = true) as total_instructors,
            (SELECT COUNT(*) FROM courses WHERE price = 0) as free_courses,
            (SELECT COUNT(*) FROM courses WHERE price > 0) as paid_courses
    `);
    return result.rows[0];
}

async function getCourseCategories() {
    const result = await query(`
        SELECT category, COUNT(*) as course_count
        FROM courses
        WHERE published = true
        GROUP BY category
        ORDER BY course_count DESC, category
    `);
    return result.rows;
}

async function searchCourses(searchTerm, category = null, level = null) {
    let sql = `
        SELECT c.*, COALESCE(u.username, 'NeurowexTech') as instructor_name
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        WHERE c.published = true
    `;
    const params = [];
    let paramIndex = 1;
    
    if (searchTerm) {
        sql += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
    }
    
    if (category && category !== 'all') {
        sql += ` AND c.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    
    if (level && level !== 'all') {
        sql += ` AND c.level = $${paramIndex}`;
        params.push(level);
        paramIndex++;
    }
    
    sql += ` ORDER BY c.featured DESC, c.created_at DESC LIMIT 50`;
    
    const result = await query(sql, params);
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
               COALESCE(ls.lesson_count, 0) as total_lessons,
               COALESCE(com.lesson_count, 0) as completed_lessons
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN (
            SELECT course_id, COUNT(*) as lesson_count
            FROM course_lessons cl
            JOIN course_modules cm ON cl.module_id = cm.id
            GROUP BY course_id
        ) ls ON c.id = ls.course_id
        LEFT JOIN (
            SELECT cm.course_id, COUNT(DISTINCT ulp.lesson_id) as lesson_count
            FROM user_lesson_progress ulp
            JOIN course_lessons cl ON ulp.lesson_id = cl.id
            JOIN course_modules cm ON cl.module_id = cm.id
            WHERE ulp.user_id = $1 AND ulp.completed = true
            GROUP BY cm.course_id
        ) com ON c.id = com.course_id
        WHERE e.user_id = $1
        ORDER BY e.enrolled_at DESC
    `, [userId]);
    return result.rows;
}

async function getAllEnrollments(limit = 100, offset = 0) {
    const result = await query(`
        SELECT e.*, u.username, u.email, c.title as course_title
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        ORDER BY e.enrolled_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
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

async function getUserCourseProgressPercentage(userId, courseId) {
    const progress = await getUserCourseProgress(userId, courseId);
    const { total_lessons, completed_lessons } = progress;
    const percentage = total_lessons > 0 ? Math.round((completed_lessons / total_lessons) * 100) : 0;
    return percentage;
}

// ========== MODULES & LESSONS ==========
async function createModule(moduleData) {
    const { course_id, title, description, module_order, duration } = moduleData;
    const result = await query(`
        INSERT INTO course_modules (course_id, title, description, module_order, duration, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
    `, [course_id, title, description || '', module_order || 0, duration || '']);
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

async function getUserByGoogleId(googleId) {
    const result = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return result.rows[0];
}

async function createUser(userData) {
    const { username, email, password_hash, role, is_active, google_id } = userData;
    const result = await query(`
        INSERT INTO users (username, email, password_hash, role, is_active, google_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, username, email, role
    `, [username, email.toLowerCase(), password_hash, role || 'user', is_active !== false, google_id || null]);
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
            last_login = COALESCE($6, last_login),
            updated_at = NOW()
        WHERE id = $7
        RETURNING id, username, email, role, is_active
    `, [username, email, password_hash, role, is_active, last_login, id]);
    return result.rows[0];
}

async function updateUserLastLogin(userId) {
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

async function deleteUser(id) {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
}

async function getAllUsers(limit = 100, offset = 0) {
    const result = await query(`
        SELECT id, username, email, role, is_active, created_at, last_login, google_id 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
}

async function countUsers(filter = {}) {
    let sql = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (filter.role) {
        sql += ` AND role = $${paramIndex}`;
        params.push(filter.role);
        paramIndex++;
    }
    if (filter.is_active !== undefined) {
        sql += ` AND is_active = $${paramIndex}`;
        params.push(filter.is_active);
        paramIndex++;
    }
    if (filter.search) {
        sql += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        params.push(`%${filter.search}%`);
        paramIndex++;
    }
    
    const result = await query(sql, params);
    return parseInt(result.rows[0].count);
}

// ========== USER ACTIVITIES ==========
async function logUserActivity(userId, activity, type = 'general', metadata = {}) {
    const result = await query(`
        INSERT INTO user_activities (user_id, activity, type, metadata, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
    `, [userId, activity, type, JSON.stringify(metadata)]);
    return result.rows[0];
}

async function getUserActivities(userId, limit = 50) {
    const result = await query(`
        SELECT * FROM user_activities 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
    `, [userId, limit]);
    return result.rows;
}

// ========== ADMIN ACTIVITIES ==========
async function logAdminActivity(adminId, action, details = {}) {
    const result = await query(`
        INSERT INTO admin_activities (admin_id, action, details, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
    `, [adminId, action, JSON.stringify(details)]);
    return result.rows[0];
}

// ========== EXPORT ALL FUNCTIONS ==========
module.exports = {
    // Connection
    query,
    pool,
    testConnection,
    transaction,
    
    // Projects
    getAllProjects,
    getProjectById,
    getProjectsByCategory,
    getRecentProjects,
    createProject,
    updateProject,
    deleteProject,
    
    // Contacts
    saveContact,
    getAllContacts,
    getUnreadContactsCount,
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
    getBlogCategories,
    
    // Blog (admin)
    getAllBlogPostsAdmin,
    getBlogPostById,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
    
    // Team
    getTeamMembers,
    getAllTeamMembers,
    getTeamMemberById,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    
    // Services
    getAllServices,
    getAllServicesAdmin,
    createService,
    updateService,
    deleteService,
    
    // Testimonials
    getTestimonials,
    getAllTestimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    
    // Settings
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
    getAllPricingPlans,
    createPricingPlan,
    updatePricingPlan,
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
    searchCourses,
    
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
    getUserCourseProgressPercentage,
    
    // Learning Platform - Modules & Lessons
    createModule,
    createLesson,
    
    // Users
    getUserByEmail,
    getUserById,
    getUserByGoogleId,
    createUser,
    updateUser,
    updateUserLastLogin,
    deleteUser,
    getAllUsers,
    countUsers,
    
    // User Activities
    logUserActivity,
    getUserActivities,
    
    // Admin Activities
    logAdminActivity,
};