// routes/api/admin.api.js — /api/admin/*
'use strict';

const { Router }               = require('express');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const db                       = require('../../db/postgres');

const router = Router();
// All routes require authentication + admin
router.use(isAuthenticated, isAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT id, username, email, role, is_active, created_at, last_login, google_id FROM users ORDER BY created_at DESC'
        );
        return res.json({ success: true, users: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/make-admin', async (req, res) => {
    try {
        const { userId } = req.body;
        if (parseInt(userId) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        await db.query("UPDATE users SET role='admin' WHERE id=$1", [userId]);
        return res.json({ success: true, message: 'User is now admin' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.post('/remove-admin', async (req, res) => {
    try {
        const { userId } = req.body;
        if (parseInt(userId) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        await db.query("UPDATE users SET role='user' WHERE id=$1", [userId]);
        return res.json({ success: true, message: 'Admin privileges removed' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/delete-user/:id', async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        const r = await db.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'User not found' });
        return res.json({ success: true, message: 'User deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// ─── Instructors ──────────────────────────────────────────────────────────────

router.get('/instructors', async (req, res) => {
    try {
        const r = await db.query(`
            SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
                   COALESCE(json_agg(
                       DISTINCT jsonb_build_object('id',c.id,'title',c.title,'category',c.category,'level',c.level,'published',c.published)
                   ) FILTER (WHERE c.id IS NOT NULL), '[]') AS courses
            FROM users u
            LEFT JOIN (
                SELECT c.id, c.title, c.category, c.level, c.published, c.instructor_id AS instructor_id
                FROM courses c
                UNION
                SELECT c.id, c.title, c.category, c.level, c.published, ica.instructor_id
                FROM courses c JOIN instructor_course_assignments ica ON c.id = ica.course_id
            ) c ON c.instructor_id = u.id
            WHERE u.role = 'instructor'
            GROUP BY u.id, u.username, u.email, u.role, u.is_active, u.created_at
            ORDER BY u.created_at DESC
        `);
        const instructors = r.rows.map(u => ({ ...u, course_count: u.courses.length }));
        return res.json({ success: true, instructors });
    } catch (err) {
        console.error('[admin] GET /instructors error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/make-instructor', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
        if (parseInt(userId) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        const check = await db.query('SELECT role FROM users WHERE id=$1', [userId]);
        if (!check.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        if (check.rows[0].role === 'admin')
            return res.status(400).json({ success: false, message: 'Cannot change the role of another admin' });
        if (check.rows[0].role === 'instructor')
            return res.json({ success: true, message: 'User is already an instructor' });
        await db.query("UPDATE users SET role='instructor' WHERE id=$1", [userId]);
        return res.json({ success: true, message: 'User promoted to instructor' });
    } catch (err) {
        console.error('[admin] make-instructor error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/remove-instructor', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
        if (parseInt(userId) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        const check = await db.query('SELECT role FROM users WHERE id=$1', [userId]);
        if (!check.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        if (check.rows[0].role !== 'instructor')
            return res.status(400).json({ success: false, message: 'User is not an instructor' });
        await db.query('DELETE FROM instructor_course_assignments WHERE instructor_id=$1', [userId]);
        const adminR = await db.query("SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1");
        if (adminR.rows.length)
            await db.query('UPDATE courses SET instructor_id=$1 WHERE instructor_id=$2', [adminR.rows[0].id, userId]);
        await db.query("UPDATE users SET role='user' WHERE id=$1", [userId]);
        return res.json({ success: true, message: 'Instructor role removed' });
    } catch (err) {
        console.error('[admin] remove-instructor error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/assign-course', async (req, res) => {
    try {
        const { instructorId, courseId } = req.body;
        if (!instructorId || !courseId)
            return res.status(400).json({ success: false, message: 'instructorId and courseId required' });
        const instrR = await db.query(
            "SELECT id, username FROM users WHERE id=$1 AND role='instructor'", [instructorId]
        );
        if (!instrR.rows.length)
            return res.status(404).json({ success: false, message: 'Instructor not found' });
        const courseR = await db.query('SELECT id, title, instructor_id FROM courses WHERE id=$1', [courseId]);
        if (!courseR.rows.length)
            return res.status(404).json({ success: false, message: 'Course not found' });
        await db.query(`
            INSERT INTO instructor_course_assignments (instructor_id, course_id, assigned_at)
            VALUES ($1,$2,NOW()) ON CONFLICT (instructor_id, course_id) DO NOTHING
        `, [instructorId, courseId]);
        if (!courseR.rows[0].instructor_id)
            await db.query('UPDATE courses SET instructor_id=$1 WHERE id=$2', [instructorId, courseId]);
        return res.json({ success: true, message: `Course assigned to ${instrR.rows[0].username}` });
    } catch (err) {
        console.error('[admin] assign-course POST error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/assign-course', async (req, res) => {
    try {
        const { instructorId, courseId } = req.body;
        if (!instructorId || !courseId)
            return res.status(400).json({ success: false, message: 'instructorId and courseId required' });
        const r = await db.query(`
            DELETE FROM instructor_course_assignments
            WHERE instructor_id=$1 AND course_id=$2 RETURNING id
        `, [instructorId, courseId]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        return res.json({ success: true, message: 'Course unassigned from instructor' });
    } catch (err) {
        console.error('[admin] assign-course DELETE error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/instructors/:id/courses', async (req, res) => {
    try {
        const instrId = parseInt(req.params.id);
        if (isNaN(instrId)) return res.status(400).json({ success: false, message: 'Invalid instructor ID' });
        const r = await db.query(`
            SELECT c.id, c.title, c.category, c.level, c.published, c.price,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),0) AS enrolled_count
            FROM courses c WHERE c.instructor_id=$1
            UNION
            SELECT c.id, c.title, c.category, c.level, c.published, c.price,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),0) AS enrolled_count
            FROM courses c JOIN instructor_course_assignments ica ON c.id=ica.course_id
            WHERE ica.instructor_id=$1
            ORDER BY title
        `, [instrId]);
        return res.json({ success: true, courses: r.rows });
    } catch (err) {
        console.error('[admin] GET instructor courses error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

router.get('/dashboard-stats', async (req, res) => {
    const safeCount = async (sql) => {
        try { const r = await db.query(sql); return parseInt(r.rows[0]?.count) || 0; }
        catch (e) { console.error('Stats query failed:', e.message); return 0; }
    };
    try {
        const [total_users, total_admins, total_instructors, total_projects,
               total_contacts, total_subscribers, total_courses, unread_contacts] = await Promise.all([
            safeCount("SELECT COUNT(*) as count FROM users"),
            safeCount("SELECT COUNT(*) as count FROM users WHERE role='admin'"),
            safeCount("SELECT COUNT(*) as count FROM users WHERE role='instructor'"),
            safeCount("SELECT COUNT(*) as count FROM projects"),
            safeCount("SELECT COUNT(*) as count FROM contacts"),
            safeCount("SELECT COUNT(*) as count FROM subscribers"),
            safeCount("SELECT COUNT(*) as count FROM courses WHERE published=true"),
            safeCount("SELECT COUNT(*) as count FROM contacts WHERE status='new' OR status IS NULL"),
        ]);
        return res.json({ success: true, stats: {
            total_users, total_admins, total_instructors, total_projects,
            total_contacts, total_subscribers, total_courses, unread_contacts,
        }});
    } catch (err) {
        console.error('[admin] dashboard stats error:', err);
        return res.status(500).json({ success: false, message: 'Unable to load statistics',
            stats: { total_users:0, total_admins:0, total_instructors:0, total_projects:0,
                     total_contacts:0, total_subscribers:0, total_courses:0, unread_contacts:0 } });
    }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get('/analytics', async (req, res) => {
    const safe = async (sql, p=[]) => {
        try { return await db.query(sql, p); } catch (e) { return { rows: [] }; }
    };
    try {
        const [usersR, newUsersR, contactsR, newContactsR,
               subsR, newSubsR, coursesR, enrollsR, newEnrollsR,
               weeklyR, topCoursesR] = await Promise.all([
            safe("SELECT COUNT(*) AS n FROM users"),
            safe("SELECT COUNT(*) AS n FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"),
            safe("SELECT COUNT(*) AS n FROM contacts"),
            safe("SELECT COUNT(*) AS n FROM contacts WHERE created_at >= NOW() - INTERVAL '30 days'"),
            safe("SELECT COUNT(*) AS n FROM subscribers"),
            safe("SELECT COUNT(*) AS n FROM subscribers WHERE subscribed_at >= NOW() - INTERVAL '30 days'"),
            safe("SELECT COUNT(*) AS n FROM courses WHERE published=true"),
            safe("SELECT COUNT(*) AS n FROM enrollments"),
            safe("SELECT COUNT(*) AS n FROM enrollments WHERE enrolled_at >= NOW() - INTERVAL '30 days'"),
            safe(`
                SELECT TO_CHAR(gs.w, 'Mon DD') AS week,
                       COALESCE((SELECT COUNT(*) FROM users        WHERE DATE_TRUNC('week',created_at)  = gs.w),0) AS users,
                       COALESCE((SELECT COUNT(*) FROM enrollments  WHERE DATE_TRUNC('week',enrolled_at) = gs.w),0) AS enrollments,
                       COALESCE((SELECT COUNT(*) FROM subscribers  WHERE DATE_TRUNC('week',subscribed_at)=gs.w),0) AS subscribers
                FROM generate_series(
                    DATE_TRUNC('week', NOW() - INTERVAL '7 weeks'),
                    DATE_TRUNC('week', NOW()),
                    INTERVAL '1 week'
                ) AS gs(w)
                ORDER BY gs.w
            `),
            safe(`
                SELECT c.title, COALESCE(COUNT(e.id),0) AS enrolled_count
                FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id
                WHERE c.published = true
                GROUP BY c.id, c.title ORDER BY enrolled_count DESC LIMIT 6
            `),
        ]);
        return res.json({
            success: true,
            stats: {
                total_users:           parseInt(usersR.rows[0]?.n)      || 0,
                new_users_month:       parseInt(newUsersR.rows[0]?.n)   || 0,
                total_contacts:        parseInt(contactsR.rows[0]?.n)   || 0,
                new_contacts_month:    parseInt(newContactsR.rows[0]?.n)|| 0,
                total_subscribers:     parseInt(subsR.rows[0]?.n)       || 0,
                new_subscribers_month: parseInt(newSubsR.rows[0]?.n)    || 0,
                total_courses:         parseInt(coursesR.rows[0]?.n)    || 0,
                total_enrollments:     parseInt(enrollsR.rows[0]?.n)    || 0,
                new_enrollments_month: parseInt(newEnrollsR.rows[0]?.n) || 0,
            },
            weekly: weeklyR.rows,
            topCourses: topCoursesR.rows,
        });
    } catch (err) {
        console.error('[admin] analytics error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM settings WHERE id=1 LIMIT 1');
        return res.json({ success: true, settings: r.rows[0] || {} });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.put('/settings', async (req, res) => {
    try {
        const { site_name, contact_email, whatsapp_number, location, tagline } = req.body;
        await db.query(`
            INSERT INTO settings (id, site_name, contact_email, whatsapp_number, location, tagline)
            VALUES (1,$1,$2,$3,$4,$5)
            ON CONFLICT (id) DO UPDATE
            SET site_name=$1, contact_email=$2, whatsapp_number=$3, location=$4, tagline=$5
        `, [site_name||'NeurowexTech', contact_email||'', whatsapp_number||'', location||'', tagline||'']);
        return res.json({ success: true, message: 'Settings saved' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// ─── Subscribers ──────────────────────────────────────────────────────────────

router.get('/subscribers', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM subscribers ORDER BY subscribed_at DESC');
        return res.json({ success: true, subscribers: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/subscribers/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM subscribers WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Subscriber not found' });
        return res.json({ success: true, message: 'Subscriber removed' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// ─── Content CRUD — Projects, Blog, Services, Testimonials, Team, FAQs, Pricing ─

// Projects
router.get('/projects', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        return res.json({ success: true, projects: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/projects', async (req, res) => {
    try {
        const { name, description, category, year, featured, client_url, tech_stack } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Project name required' });
        const r = await db.query(
            `INSERT INTO projects (name,description,category,year,featured,client_url,tech_stack,created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
            [name, description||'', category||'Web', year||new Date().getFullYear(),
             featured||false, client_url||'', tech_stack||'']
        );
        return res.json({ success: true, message: 'Project created', project: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.put('/projects/:id', async (req, res) => {
    try {
        const { name,description,category,year,featured,client_url,tech_stack } = req.body;
        const r = await db.query(
            `UPDATE projects SET name=COALESCE($1,name),description=COALESCE($2,description),
             category=COALESCE($3,category),year=COALESCE($4,year),featured=COALESCE($5,featured),
             client_url=COALESCE($6,client_url),tech_stack=COALESCE($7,tech_stack) WHERE id=$8 RETURNING *`,
            [name,description,category,year,featured,client_url,tech_stack,req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Project not found' });
        return res.json({ success: true, message: 'Project updated', project: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/projects/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM projects WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Project not found' });
        return res.json({ success: true, message: 'Project deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// Blog
router.get('/blog', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
        return res.json({ success: true, posts: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/blog', async (req, res) => {
    try {
        const { title,slug,category,author,excerpt,external_url,published } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title required' });
        const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
        const r = await db.query(
            `INSERT INTO blog_posts (title,slug,category,author,excerpt,external_url,published,created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
            [title,finalSlug,category||'General',author||'Admin',excerpt||'',external_url||'',published||false]
        );
        return res.json({ success: true, message: 'Post created', post: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/blog/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM blog_posts WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Post not found' });
        return res.json({ success: true, message: 'Post deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// Services
router.get('/services', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM services ORDER BY id ASC');
        return res.json({ success: true, services: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/services', async (req, res) => {
    try {
        const { name,description,icon_class,price } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Service name required' });
        const r = await db.query(
            `INSERT INTO services (name,description,icon_class,price,visible) VALUES ($1,$2,$3,$4,true) RETURNING *`,
            [name,description||'',icon_class||'',price||'']
        );
        return res.json({ success: true, message: 'Service added', service: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/services/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM services WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Service not found' });
        return res.json({ success: true, message: 'Service deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// Testimonials
router.get('/testimonials', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM testimonials ORDER BY created_at DESC');
        return res.json({ success: true, testimonials: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/testimonials', async (req, res) => {
    try {
        const { client_name,client_role,company,rating,content } = req.body;
        if (!client_name||!content)
            return res.status(400).json({ success: false, message: 'Client name and content required' });
        const r = await db.query(
            `INSERT INTO testimonials (client_name,client_role,company,rating,content,published,created_at)
             VALUES ($1,$2,$3,$4,$5,true,NOW()) RETURNING *`,
            [client_name,client_role||'',company||'',rating||5,content]
        );
        return res.json({ success: true, message: 'Testimonial added', testimonial: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/testimonials/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM testimonials WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Testimonial not found' });
        return res.json({ success: true, message: 'Testimonial deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// Team
router.get('/team', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM team ORDER BY id ASC');
        return res.json({ success: true, team: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/team', async (req, res) => {
    try {
        const { name,role,bio,linkedin_url,github_url } = req.body;
        if (!name||!role) return res.status(400).json({ success: false, message: 'Name and role required' });
        const r = await db.query(
            `INSERT INTO team (name,role,bio,linkedin_url,github_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [name,role,bio||'',linkedin_url||'',github_url||'']
        );
        return res.json({ success: true, message: 'Member added', member: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/team/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM team WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Member not found' });
        return res.json({ success: true, message: 'Member removed' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// FAQs
router.get('/faqs', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM faqs ORDER BY display_order ASC, id ASC');
        return res.json({ success: true, faqs: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/faqs', async (req, res) => {
    try {
        const { question,answer,order:displayOrder,active } = req.body;
        if (!question||!answer)
            return res.status(400).json({ success: false, message: 'Question and answer required' });
        const r = await db.query(
            `INSERT INTO faqs (question,answer,display_order,active,created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
            [question,answer,parseInt(displayOrder)||1,active!==false]
        );
        return res.json({ success: true, message: 'FAQ added', faq: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.put('/faqs/:id', async (req, res) => {
    try {
        const { question,answer,display_order,active } = req.body;
        const r = await db.query(
            `UPDATE faqs SET question=COALESCE($1,question),answer=COALESCE($2,answer),
             display_order=COALESCE($3,display_order),active=COALESCE($4,active) WHERE id=$5 RETURNING *`,
            [question,answer,display_order,active,req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'FAQ not found' });
        return res.json({ success: true, message: 'FAQ updated', faq: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/faqs/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM faqs WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'FAQ not found' });
        return res.json({ success: true, message: 'FAQ deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// Pricing
router.get('/pricing', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM pricing_plans ORDER BY price ASC');
        return res.json({ success: true, plans: r.rows });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/pricing', async (req, res) => {
    try {
        const { name,tier,price,price_label,features,popular } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Plan name required' });
        const featuresArr = Array.isArray(features)
            ? features
            : (features ? String(features).split('\n').filter(Boolean) : []);
        const r = await db.query(
            `INSERT INTO pricing_plans (name,tier,price,price_label,features,popular,created_at)
             VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
            [name,tier||'',parseInt(price)||0,price_label||`Kshs ${price}`,JSON.stringify(featuresArr),popular||false]
        );
        return res.json({ success: true, message: 'Plan added', plan: r.rows[0] });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/pricing/:id', async (req, res) => {
    try {
        const r = await db.query('DELETE FROM pricing_plans WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Plan not found' });
        return res.json({ success: true, message: 'Plan deleted' });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
