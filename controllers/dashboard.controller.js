// controllers/dashboard.controller.js
'use strict';

const db = require('../db/postgres');

// ─── User Dashboard ──────────────────────────────────────────────────────────

async function userDashboard(req, res) {
    try {
        const uid = req.session.userId;
        const [userR, statsR, enrollmentsR, recentR] = await Promise.all([
            db.query('SELECT id, username, email, role, created_at, last_login FROM users WHERE id=$1', [uid]),
            db.query(`
                SELECT
                    (SELECT COUNT(*) FROM projects    WHERE user_id=$1)                          AS total_projects,
                    (SELECT COUNT(*) FROM projects    WHERE user_id=$1 AND status='Completed')   AS completed_projects,
                    (SELECT COUNT(*) FROM projects    WHERE user_id=$1 AND status='In Progress') AS active_projects,
                    (SELECT COUNT(*) FROM enrollments WHERE user_id=$1)                          AS total_enrollments,
                    (SELECT COUNT(*) FROM enrollments WHERE user_id=$1 AND status='active')      AS active_enrollments,
                    (SELECT COALESCE(AVG(progress),0) FROM enrollments WHERE user_id=$1)         AS avg_progress
            `, [uid]),
            db.query(`
                SELECT e.id, e.enrolled_at, e.progress, e.status,
                       c.id AS course_id, c.title, c.category, c.level, c.image_url,
                       c.price, c.total_duration, u.username AS instructor_name
                FROM enrollments e
                JOIN courses c ON e.course_id = c.id
                JOIN users   u ON c.instructor_id = u.id
                WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC
            `, [uid]).catch(() => ({ rows: [] })),
            db.query(
                'SELECT * FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8', [uid]
            ).catch(() => ({ rows: [] })),
        ]);

        if (!userR.rows.length) {
            req.session.destroy();
            return res.redirect('/login');
        }

        const stats = statsR.rows[0] || {};
        return res.render('user_dashboard', {
            title: 'Dashboard – NeurowexTech',
            user:  userR.rows[0],
            stats: {
                totalProjects:     parseInt(stats.total_projects)     || 0,
                completedProjects: parseInt(stats.completed_projects) || 0,
                activeProjects:    parseInt(stats.active_projects)    || 0,
                totalEnrollments:  parseInt(stats.total_enrollments)  || 0,
                activeEnrollments: parseInt(stats.active_enrollments) || 0,
                avgProgress:       Math.round(parseFloat(stats.avg_progress) || 0),
            },
            enrollments:    enrollmentsR.rows,
            recentActivity: recentR.rows,
        });
    } catch (err) {
        console.error('[dashboard] user error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

async function adminDashboard(req, res) {
    try {
        const safeCount = async (sql) => {
            try {
                const r = await db.query(sql);
                return parseInt(r.rows[0].count) || 0;
            } catch (e) {
                console.log('[dashboard] safeCount skip:', e.message);
                return 0;
            }
        };

        const stats = {
            total_users:       await safeCount("SELECT COUNT(*) as count FROM users"),
            total_admins:      await safeCount("SELECT COUNT(*) as count FROM users WHERE role='admin'"),
            total_instructors: await safeCount("SELECT COUNT(*) as count FROM users WHERE role='instructor'"),
            active_users:      await safeCount("SELECT COUNT(*) as count FROM users WHERE is_active=true"),
            total_contacts:    await safeCount("SELECT COUNT(*) as count FROM contacts"),
            total_subscribers: await safeCount("SELECT COUNT(*) as count FROM subscribers"),
            total_projects:    await safeCount("SELECT COUNT(*) as count FROM projects"),
            total_courses:     await safeCount("SELECT COUNT(*) as count FROM courses WHERE published=true"),
        };

        return res.render('admin_dashboard', {
            title: 'Admin Panel – NeurowexTech',
            stats,
            userName: req.session.userName,
        });
    } catch (err) {
        console.error('[dashboard] admin error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
}

// ─── Instructor Dashboard ─────────────────────────────────────────────────────

async function instructorDashboard(req, res) {
    try {
        const userId     = req.session.userId;
        const isAdminUser = req.session.userRole === 'admin';

        const coursesR = await db.query(`
            SELECT c.*,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id), 0) AS enrolled_count
            FROM courses c
            WHERE c.instructor_id = $1
               OR c.id IN (SELECT course_id FROM instructor_course_assignments WHERE instructor_id = $1)
            ORDER BY c.created_at DESC
        `, [userId]);

        const courses       = coursesR.rows;
        const totalEnrolled = courses.reduce((s, c) => s + parseInt(c.enrolled_count || 0), 0);

        return res.render('instructor_dashboard', {
            title:        'Instructor Hub – NeurowexTech',
            courses,
            totalCourses: courses.length,
            totalEnrolled,
            isAdminUser,
        });
    } catch (err) {
        console.error('[dashboard] instructor error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
}

// ─── Instructor Course Editor ─────────────────────────────────────────────────

async function instructorCoursePage(req, res) {
    try {
        const courseId = parseInt(req.params.id);
        const userId   = req.session.userId;

        if (isNaN(courseId)) return res.redirect('/instructor/dashboard');

        // Confirm access unless admin
        if (req.session.userRole !== 'admin') {
            const accessR = await db.query(`
                SELECT 1 FROM courses WHERE id=$1 AND instructor_id=$2
                UNION
                SELECT 1 FROM instructor_course_assignments WHERE course_id=$1 AND instructor_id=$2
            `, [courseId, userId]);
            if (!accessR.rows.length)
                return res.status(403).render('error', {
                    title: 'Access Denied', message: 'You are not assigned to this course.',
                });
        }

        const courseR = await db.query(`
            SELECT c.*, u.username AS instructor_name_display
            FROM courses c LEFT JOIN users u ON c.instructor_id = u.id
            WHERE c.id = $1
        `, [courseId]);
        if (!courseR.rows.length) return res.redirect('/instructor/dashboard');
        const course = courseR.rows[0];

        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object(
                           'id',           cl.id,
                           'title',        cl.title,
                           'duration',     cl.duration,
                           'lesson_order', cl.lesson_order,
                           'video_url',    cl.video_url,
                           'is_free',      cl.is_free,
                           'is_published', COALESCE(cl.is_published, true)
                       ) ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL), '[]') AS lessons
            FROM course_modules cm
            LEFT JOIN course_lessons cl ON cm.id = cl.module_id
            WHERE cm.course_id = $1
            GROUP BY cm.id ORDER BY cm.module_order
        `, [courseId]);

        const enrollR = await db.query(`
            SELECT u.username, e.enrolled_at, e.progress
            FROM enrollments e JOIN users u ON e.user_id = u.id
            WHERE e.course_id = $1
            ORDER BY e.enrolled_at DESC LIMIT 20
        `, [courseId]);

        const ratingR = await db.query(`
            SELECT COALESCE(AVG(rating), 0) AS average_rating, COUNT(*) AS total_reviews
            FROM course_reviews WHERE course_id = $1
        `, [courseId]).catch(() => ({ rows: [{ average_rating: 0, total_reviews: 0 }] }));

        const totalRevenue = parseFloat(course.price || 0) > 0
            ? Math.round(parseFloat(course.price) * parseInt(course.enrolled_count || 0))
            : 0;

        return res.render('instructor', {
            title:             `Instructor – ${course.title}`,
            courseId,
            courseTitle:       course.title,
            courseSlug:        course.slug            || '',
            courseLevel:       course.level           || 'Beginner',
            courseStatus:      course.published ? 'published' : 'draft',
            courseDescription: course.description     || '',
            courseThumbnail:   course.image_url       || '',
            totalDuration:     course.total_duration  || '',
            totalModules:      modulesR.rows.length,
            totalLessons:      modulesR.rows.reduce((s, m) =>
                                   s + ((m.lessons || []).filter(l => l && l.id).length), 0),
            modules:           modulesR.rows,
            totalEnrolled:     parseInt(course.enrolled_count || 0),
            totalRevenue,
            averageRating:     parseFloat(ratingR.rows[0]?.average_rating || 0).toFixed(1),
            totalReviews:      parseInt(ratingR.rows[0]?.total_reviews || 0),
            recentEnrollments: enrollR.rows,
        });
    } catch (err) {
        console.error('[dashboard] instructor course page error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
}

module.exports = { userDashboard, adminDashboard, instructorDashboard, instructorCoursePage };
