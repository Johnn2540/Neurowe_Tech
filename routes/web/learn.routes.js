// routes/web/learn.routes.js — /learn, /learn/course/:id, /learn/course/:id/dashboard, /my-learning
'use strict';

const { Router }         = require('express');
const { isAuthenticated} = require('../../middleware/auth');
const db                 = require('../../db/postgres');

const router = Router();

// ─── Course catalogue ─────────────────────────────────────────────────────────

router.get('/learn', async (req, res) => {
    try {
        const [coursesR, categoriesR, statsR] = await Promise.all([
            db.query(`
                SELECT c.*,
                       COALESCE(u.username,'NeurowexTech') AS instructor_name,
                       0 AS enrolled_count, 0 AS total_lessons, 0 AS total_modules
                FROM courses c LEFT JOIN users u ON c.instructor_id=u.id
                WHERE c.published=true
                ORDER BY c.featured DESC, c.created_at DESC
            `),
            db.query(`
                SELECT category, COUNT(*) AS course_count
                FROM courses WHERE published=true AND category IS NOT NULL
                GROUP BY category ORDER BY category
            `),
            db.query(`
                SELECT (SELECT COUNT(*) FROM courses WHERE published=true) AS total_courses,
                       (SELECT COUNT(DISTINCT category) FROM courses WHERE published=true) AS total_categories,
                       0 AS total_enrollments, 0 AS total_instructors
            `),
        ]);

        const courses    = coursesR.rows    || [];
        const categories = categoriesR.rows || [];
        const stats      = statsR.rows[0]   || {};
        const freeCourses = courses.filter(c => parseFloat(c.price) === 0);
        const paidCourses = courses.filter(c => parseFloat(c.price) >  0);
        const levelCounts = { beginner:0, intermediate:0, advanced:0 };
        courses.forEach(c => {
            if (c.level) levelCounts[c.level.toLowerCase()] = (levelCounts[c.level.toLowerCase()]||0)+1;
        });

        let userEnrollments = [];
        if (req.session.userId) {
            try {
                const enrollR = await db.query(
                    'SELECT course_id FROM enrollments WHERE user_id=$1', [req.session.userId]
                );
                userEnrollments = enrollR.rows.map(e => e.course_id);
            } catch {}
        }

        return res.render('learn', {
            title: 'NeurowexTech Learn – Practical Skills, Real Results',
            freeCourses, paidCourses, categories, stats,
            featuredCourse:    courses.find(c => c.bestseller) || courses[0] || null,
            beginnerCount:     levelCounts.beginner,
            intermediateCount: levelCounts.intermediate,
            advancedCount:     levelCounts.advanced,
            freeCoursesCount:  freeCourses.length,
            paidCoursesCount:  paidCourses.length,
            userEnrollments,
        });
    } catch (err) {
        console.error('[learn] catalogue error:', err);
        return res.render('learn', {
            title: 'NeurowexTech Learn',
            freeCourses:[], paidCourses:[], categories:[], stats:{}, featuredCourse:null,
            beginnerCount:0, intermediateCount:0, advancedCount:0,
            freeCoursesCount:0, paidCoursesCount:0, userEnrollments:[],
        });
    }
});

// ─── Course detail ────────────────────────────────────────────────────────────

router.get('/learn/course/:id', async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        if (isNaN(courseId)) return res.status(404).render('404', { title: 'Course Not Found' });

        const cR = await db.query(`
            SELECT c.*, COALESCE(u.username,'NeurowexTech') AS instructor_name,
                   u.email AS instructor_email,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),0) AS total_enrolled
            FROM courses c LEFT JOIN users u ON c.instructor_id=u.id
            WHERE c.id=$1 AND c.published=true
        `, [courseId]);
        if (!cR.rows.length) return res.status(404).render('404', { title: 'Course Not Found' });
        const course = cR.rows[0];

        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object('id',cl.id,'title',cl.title,'duration',cl.duration,
                           'lesson_order',cl.lesson_order,'is_free',cl.is_free,'video_url',cl.video_url)
                       ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL),'[]') AS lessons
            FROM course_modules cm LEFT JOIN course_lessons cl ON cm.id=cl.module_id
            WHERE cm.course_id=$1
            GROUP BY cm.id ORDER BY cm.module_order
        `, [courseId]);

        const modules      = modulesR.rows;
        const totalLessons = modules.reduce((s,m)=>s+(m.lessons?.filter(l=>l&&l.id)?.length||0),0);

        let isEnrolled=false, enrollmentProgress=0, enrollmentId=null;
        if (req.session.userId) {
            const eR = await db.query(
                'SELECT id,progress FROM enrollments WHERE user_id=$1 AND course_id=$2',
                [req.session.userId, courseId]
            );
            if (eR.rows.length) {
                isEnrolled=true; enrollmentProgress=eR.rows[0].progress||0; enrollmentId=eR.rows[0].id;
            }
        }

        const relatedR = await db.query(`
            SELECT id,title,category,level,rating,image_url,price
            FROM courses WHERE category=$1 AND id!=$2 AND published=true LIMIT 3
        `, [course.category, courseId]);

        return res.render('course-detail', {
            title: `${course.title} – NeurowexTech Learn`,
            course, modules, totalLessons, isEnrolled, enrollmentProgress, enrollmentId,
            relatedCourses: relatedR.rows||[],
        });
    } catch (err) {
        console.error('[learn] course detail error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// ─── Course dashboard (enrolled users) ───────────────────────────────────────

router.get('/learn/course/:id/dashboard', isAuthenticated, async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        const userId   = req.session.userId;
        if (isNaN(courseId)) return res.redirect('/learn');

        const eR = await db.query(`
            SELECT e.*, c.title, c.description, c.image_url, c.category, c.level, c.total_duration
            FROM enrollments e JOIN courses c ON e.course_id=c.id
            WHERE e.user_id=$1 AND e.course_id=$2
        `, [userId, courseId]);
        if (!eR.rows.length) return res.redirect(`/learn/course/${courseId}`);
        const enrollment = eR.rows[0];

        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object('id',cl.id,'title',cl.title,'description','',
                           'duration',cl.duration,'lesson_order',cl.lesson_order,'video_url',cl.video_url,
                           'completed',COALESCE(ulp.completed,false))
                       ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL),'[]') AS lessons
            FROM course_modules cm
            LEFT JOIN course_lessons cl ON cm.id=cl.module_id
            LEFT JOIN user_lesson_progress ulp ON cl.id=ulp.lesson_id AND ulp.user_id=$1
            WHERE cm.course_id=$2
            GROUP BY cm.id ORDER BY cm.module_order
        `, [userId, courseId]);

        const modules = modulesR.rows;
        const allLessons = [];
        modules.forEach(mod => {
            (mod.lessons||[]).forEach(lesson => {
                if (lesson&&lesson.id) allLessons.push({...lesson, moduleTitle:mod.title, moduleId:mod.id});
            });
        });

        const totalLessons     = allLessons.length;
        const completedLessons = allLessons.filter(l=>l.completed).length;
        const progress         = totalLessons>0 ? Math.round((completedLessons/totalLessons)*100) : 0;

        if (progress !== enrollment.progress)
            await db.query('UPDATE enrollments SET progress=$1 WHERE id=$2', [progress, enrollment.id]);

        modules.forEach(mod => {
            const valid = (mod.lessons||[]).filter(l=>l&&l.id);
            mod.totalLessons     = valid.length;
            mod.completedLessons = valid.filter(l=>l.completed).length;
        });

        const currentLesson = allLessons.find(l=>!l.completed) || allLessons[allLessons.length-1];
        const currentIdx    = currentLesson ? allLessons.indexOf(currentLesson) : -1;
        modules.forEach(mod => {
            (mod.lessons||[]).forEach(lesson => {
                lesson.isCurrent = currentLesson ? lesson.id===currentLesson.id : false;
            });
        });

        return res.render('course-dashboard', {
            title:                   `${enrollment.title} – My Learning`,
            courseId,
            courseTitle:             enrollment.title,
            courseLevel:             enrollment.level        || 'All Levels',
            totalDuration:           enrollment.total_duration || 'Self-paced',
            totalModules:            modules.length,
            modules,
            progress,
            completedLessons,
            totalLessons,
            currentLessonId:         currentLesson?.id         ?? null,
            currentLessonTitle:      currentLesson?.title       ?? '',
            currentLessonDescription:'',
            currentVideoUrl:         currentLesson?.video_url   ?? '',
            currentModuleTitle:      currentLesson?.moduleTitle ?? '',
            currentLessonCompleted:  currentLesson?.completed   ?? false,
            hasPrevLesson:           currentIdx > 0,
            hasNextLesson:           currentIdx >= 0 && currentIdx < allLessons.length-1,
            enrolledAt:              enrollment.enrolled_at,
        });
    } catch (err) {
        console.error('[learn] course dashboard error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// ─── My Learning ──────────────────────────────────────────────────────────────

router.get('/my-learning', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const r = await db.query(`
            SELECT e.*, c.id AS course_id, c.title, c.category, c.level, c.image_url,
                   c.description, c.total_duration,
                   COALESCE(u.username,'NeurowexTech') AS instructor_name,
                   COALESCE(ls.lesson_count,0) AS total_lessons
            FROM enrollments e JOIN courses c ON e.course_id=c.id
            LEFT JOIN users u ON c.instructor_id=u.id
            LEFT JOIN (SELECT course_id,COUNT(*) as lesson_count FROM course_lessons GROUP BY course_id) ls
                ON c.id=ls.course_id
            WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC
        `, [userId]);

        const enrollments      = r.rows || [];
        const totalEnrolled    = enrollments.length;
        const activeCourses    = enrollments.filter(e=>e.status==='active').length;
        const completedCourses = enrollments.filter(e=>e.progress===100).length;
        const averageProgress  = totalEnrolled>0
            ? Math.round(enrollments.reduce((s,e)=>s+(e.progress||0),0)/totalEnrolled) : 0;

        return res.render('my-learning', {
            title: 'My Learning – NeurowexTech',
            enrollments,
            stats: { totalEnrolled, activeCourses, completedCourses, averageProgress },
        });
    } catch (err) {
        console.error('[learn] my-learning error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

module.exports = router;
