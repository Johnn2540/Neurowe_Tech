// routes/web/kids.routes.js — /kids-academy, /kids-academy/course/:id, /kids-academy/my-kids
'use strict';

const { Router }          = require('express');
const { isAuthenticated } = require('../../middleware/auth');
const db                  = require('../../db/postgres');

const router = Router();

// ─── GET /kids-academy — course catalogue (kids courses only) ─────────────────

router.get('/kids-academy', async (req, res) => {
    try {
        const coursesR = await db.query(`
            SELECT c.*,
                   COALESCE(u.username, 'NeurowexTech') AS instructor_name,
                   COALESCE((SELECT COUNT(*) FROM kids_enrollments ke WHERE ke.course_id = c.id), 0)::int AS kids_enrolled,
                   COALESCE((SELECT COUNT(cl.id) FROM course_lessons cl
                              JOIN course_modules cm ON cl.module_id = cm.id
                              WHERE cm.course_id = c.id), 0)::int AS total_lessons,
                   COALESCE((SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id), 0)::int AS total_modules
            FROM courses c
            LEFT JOIN users u ON c.instructor_id = u.id
            WHERE c.published = true AND c.category = 'Kids Coding'
            ORDER BY c.featured DESC, c.created_at DESC
        `);

        const courses = coursesR.rows.map(c => ({
            ...c,
            isFree:        parseFloat(c.price) === 0,
            priceLabel:    parseFloat(c.price) === 0 ? 'Free' : `Ksh ${c.price}`,
            kids_enrolled: parseInt(c.kids_enrolled) || 0,
            total_lessons: parseInt(c.total_lessons) || 0,
            levelLower:    (c.level || 'beginner').toLowerCase(),
        }));

        let parentChildren = [];
        if (req.session.userId) {
            const cr = await db.query(
                `SELECT id, name, age, avatar_emoji FROM user_children WHERE parent_id=$1 ORDER BY created_at ASC`,
                [req.session.userId]
            ).catch(() => ({ rows: [] }));
            parentChildren = cr.rows;
        }

        return res.render('kids_academy', {
            title:        'Kids Coding Academy – NeurowexTech',
            courses,
            parentChildren,
            totalCourses: courses.length,
            freeCourses:  courses.filter(c => c.isFree).length,
        });
    } catch (err) {
        console.error('[kids] catalogue error:', err);
        return res.render('kids_academy', {
            title: 'Kids Coding Academy – NeurowexTech',
            courses: [], parentChildren: [], totalCourses: 0, freeCourses: 0,
        });
    }
});

// ─── GET /kids-academy/course/:id — course detail ─────────────────────────────

router.get('/kids-academy/course/:id', async (req, res) => {
    try {
        const courseId = parseInt(req.params.id, 10);
        if (isNaN(courseId))
            return res.status(404).render('error', { title: 'Not Found', message: 'Course not found' });

        const cR = await db.query(`
            SELECT c.*, COALESCE(u.username, 'NeurowexTech') AS instructor_name,
                   COALESCE((SELECT COUNT(*) FROM kids_enrollments ke WHERE ke.course_id=c.id), 0) AS total_enrolled
            FROM courses c
            LEFT JOIN users u ON c.instructor_id = u.id
            WHERE c.id = $1 AND c.published = true AND c.category = 'Kids Coding'
        `, [courseId]);
        if (!cR.rows.length)
            return res.status(404).render('error', { title: 'Not Found', message: 'Kids course not found' });

        const course = {
            ...cR.rows[0],
            isFree:     parseFloat(cR.rows[0].price) === 0,
            priceLabel: parseFloat(cR.rows[0].price) === 0 ? 'Free' : `Ksh ${cR.rows[0].price}`,
        };

        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object('id',cl.id,'title',cl.title,'duration',cl.duration,
                           'lesson_order',cl.lesson_order,'is_free',cl.is_free,'video_url',cl.video_url)
                       ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL), '[]') AS lessons
            FROM course_modules cm
            LEFT JOIN course_lessons cl ON cm.id = cl.module_id
            WHERE cm.course_id = $1
            GROUP BY cm.id ORDER BY cm.module_order
        `, [courseId]);

        const modules      = modulesR.rows;
        const totalLessons = modules.reduce((s, m) => s + ((m.lessons || []).filter(l => l && l.id).length), 0);

        let children = [];
        if (req.session.userId) {
            const cr = await db.query(
                `SELECT id, name, age, avatar_emoji FROM user_children WHERE parent_id=$1 ORDER BY created_at ASC`,
                [req.session.userId]
            ).catch(() => ({ rows: [] }));
            const rawChildren = cr.rows;

            if (rawChildren.length) {
                const ids = rawChildren.map(c => c.id);
                const er  = await db.query(
                    `SELECT child_id, progress FROM kids_enrollments WHERE course_id=$1 AND child_id=ANY($2::int[])`,
                    [courseId, ids]
                ).catch(() => ({ rows: [] }));
                const enrolledMap = {};
                er.rows.forEach(e => { enrolledMap[e.child_id] = e.progress; });
                children = rawChildren.map(c => ({
                    ...c,
                    isEnrolled: c.id in enrolledMap,
                    progress:   enrolledMap[c.id] || 0,
                }));
            }
        }

        const enrolledChildIds = children.filter(c => c.isEnrolled).map(c => c.id);

        return res.render('kids_course_detail', {
            title:            `${course.title} – Kids Academy`,
            course,
            modules,
            totalLessons,
            children,
            hasChildren:      children.length > 0,
            enrolledChildIds: JSON.stringify(enrolledChildIds),
        });
    } catch (err) {
        console.error('[kids] course detail error:', err);
        return res.status(500).render('error', { title: 'Error', message: 'Something went wrong. Please try again later.' });
    }
});

// ─── GET /kids-academy/my-kids — parent dashboard ────────────────────────────

router.get('/kids-academy/my-kids', isAuthenticated, async (req, res) => {
    try {
        const parentId = req.session.userId;

        const childrenR = await db.query(
            `SELECT * FROM user_children WHERE parent_id=$1 ORDER BY created_at ASC`,
            [parentId]
        );
        const children = childrenR.rows;

        if (children.length) {
            const ids = children.map(c => c.id);
            const enrollR = await db.query(`
                SELECT ke.child_id, ke.course_id, ke.progress, ke.status, ke.enrolled_at,
                       c.title, c.image_url, c.category, c.level,
                       COALESCE(u.username, 'NeurowexTech') AS instructor_name
                FROM kids_enrollments ke
                JOIN courses c    ON ke.course_id = c.id
                LEFT JOIN users u ON c.instructor_id = u.id
                WHERE ke.child_id = ANY($1::int[])
                ORDER BY ke.enrolled_at DESC
            `, [ids]);

            children.forEach(child => {
                child.enrollments     = enrollR.rows.filter(e => e.child_id === child.id);
                child.totalCourses    = child.enrollments.length;
                child.completedCourses = child.enrollments.filter(e => parseInt(e.progress) === 100).length;
            });
        } else {
            children.forEach(child => {
                child.enrollments = []; child.totalCourses = 0; child.completedCourses = 0;
            });
        }

        return res.render('kids_dashboard', {
            title:         "My Kids' Learning – NeurowexTech",
            children,
            totalChildren: children.length,
        });
    } catch (err) {
        console.error('[kids] my-kids error:', err);
        return res.status(500).render('error', { title: 'Error', message: 'Something went wrong. Please try again later.' });
    }
});

// ─── GET /kids-academy/course/:courseId/learn/:childId — lesson player ────────

router.get('/kids-academy/course/:courseId/learn/:childId', isAuthenticated, async (req, res) => {
    try {
        const courseId = parseInt(req.params.courseId, 10);
        const childId  = parseInt(req.params.childId,  10);
        const parentId = req.session.userId;

        if (isNaN(courseId) || isNaN(childId))
            return res.redirect('/kids-academy/my-kids');

        // Verify child ownership
        const childR = await db.query(
            `SELECT id, name, avatar_emoji FROM user_children WHERE id=$1 AND parent_id=$2`,
            [childId, parentId]
        );
        if (!childR.rows.length)
            return res.status(403).render('error', {
                title:   'Access Denied',
                message: 'This child profile does not belong to your account.',
            });

        const child = childR.rows[0];

        // Verify enrollment
        const eR = await db.query(`
            SELECT ke.*, c.title, c.description, c.image_url, c.category, c.level, c.total_duration
            FROM kids_enrollments ke
            JOIN courses c ON ke.course_id = c.id
            WHERE ke.child_id=$1 AND ke.course_id=$2
        `, [childId, courseId]);
        if (!eR.rows.length)
            return res.redirect(`/kids-academy/course/${courseId}`);

        const enrollment = eR.rows[0];

        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object(
                           'id',cl.id,'title',cl.title,'description','',
                           'duration',cl.duration,'lesson_order',cl.lesson_order,
                           'video_url',cl.video_url,'completed',COALESCE(klp.completed,false)
                       ) ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL), '[]') AS lessons
            FROM course_modules cm
            LEFT JOIN course_lessons cl ON cm.id = cl.module_id
            LEFT JOIN kids_lesson_progress klp ON cl.id = klp.lesson_id AND klp.child_id = $1
            WHERE cm.course_id = $2
            GROUP BY cm.id ORDER BY cm.module_order
        `, [childId, courseId]);

        const modules    = modulesR.rows;
        const allLessons = [];
        modules.forEach(mod => {
            (mod.lessons || []).forEach(lesson => {
                if (lesson && lesson.id) allLessons.push({ ...lesson, moduleTitle: mod.title, moduleId: mod.id });
            });
        });

        const totalLessons     = allLessons.length;
        const completedLessons = allLessons.filter(l => l.completed).length;
        const progress         = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        if (progress !== enrollment.progress)
            await db.query(
                `UPDATE kids_enrollments SET progress=$1 WHERE child_id=$2 AND course_id=$3`,
                [progress, childId, courseId]
            );

        modules.forEach(mod => {
            const valid = (mod.lessons || []).filter(l => l && l.id);
            mod.totalLessons     = valid.length;
            mod.completedLessons = valid.filter(l => l.completed).length;
        });

        const currentLesson = allLessons.find(l => !l.completed) || allLessons[allLessons.length - 1] || null;
        const currentIdx    = currentLesson ? allLessons.indexOf(currentLesson) : -1;
        modules.forEach(mod => {
            (mod.lessons || []).forEach(lesson => {
                lesson.isCurrent = currentLesson ? lesson.id === currentLesson.id : false;
            });
        });

        return res.render('kids_learn', {
            title:                  `${enrollment.title} — ${child.name}'s Learning`,
            courseId,
            childId,
            childName:              child.name,
            childAvatar:            child.avatar_emoji || '🧒',
            courseTitle:            enrollment.title,
            courseLevel:            enrollment.level        || 'Beginner',
            totalDuration:          enrollment.total_duration || 'Self-paced',
            totalModules:           modules.length,
            modules,
            progress,
            completedLessons,
            totalLessons,
            currentLessonId:        currentLesson?.id          ?? null,
            currentLessonTitle:     currentLesson?.title        ?? '',
            currentVideoUrl:        currentLesson?.video_url    ?? '',
            currentModuleTitle:     currentLesson?.moduleTitle  ?? '',
            currentLessonCompleted: currentLesson?.completed    ?? false,
            hasPrevLesson:          currentIdx > 0,
            hasNextLesson:          currentIdx >= 0 && currentIdx < allLessons.length - 1,
            enrolledAt:             enrollment.enrolled_at,
        });
    } catch (err) {
        console.error('[kids] learn error:', err);
        return res.status(500).render('error', { title: 'Error', message: 'Something went wrong. Please try again later.' });
    }
});

module.exports = router;
