// routes/api/courses.api.js — /api/learn/* and /api/courses/* and /api/enroll*
'use strict';

const { Router }                         = require('express');
const { isAuthenticated, isAdmin }       = require('../../middleware/auth');
const db                                 = require('../../db/postgres');

const router = Router();

// ─── Public stats ─────────────────────────────────────────────────────────────

router.get('/dashboard/public-stats', async (req, res) => {
    const safeCount = async (sql, def=0) => {
        try { const r = await db.query(sql); return parseInt(r.rows[0]?.count)||def; } catch { return def; }
    };
    try {
        const [total_courses, total_enrollments, total_instructors] = await Promise.all([
            safeCount("SELECT COUNT(*) as count FROM courses WHERE published=true"),
            safeCount("SELECT COUNT(*) as count FROM enrollments"),
            safeCount("SELECT COUNT(*) as count FROM users WHERE role='instructor'"),
        ]);
        return res.json({ success:true, stats:{total_courses,total_enrollments,total_instructors} });
    } catch (err) {
        return res.status(500).json({ success:false, stats:{total_courses:0,total_enrollments:0,total_instructors:0} });
    }
});

// ─── Course search (public) ───────────────────────────────────────────────────

router.get('/courses/search', async (req, res) => {
    try {
        const { q, category, level, price } = req.query;
        if (q && q.length > 200)
            return res.status(400).json({ success: false, message: 'Search query too long', courses: [] });
        let query = `
            SELECT c.*, COALESCE(u.username,'NeurowexTech') AS instructor_name,
                   COALESCE(e.enrolled_count,0) AS enrolled_count
            FROM courses c
            LEFT JOIN users u ON c.instructor_id=u.id
            LEFT JOIN (SELECT course_id,COUNT(*) as enrolled_count FROM enrollments GROUP BY course_id) e
                ON c.id=e.course_id
            WHERE c.published=true
        `;
        const params=[]; let i=1;
        if (q)        { query+=` AND (c.title ILIKE $${i} OR c.description ILIKE $${i})`; params.push(`%${q}%`); i++; }
        if (category && category!=='all') { query+=` AND c.category=$${i}`; params.push(category); i++; }
        if (level    && level!=='all')    { query+=` AND c.level=$${i}`;    params.push(level);    i++; }
        if (price==='free')      query+=` AND c.price=0`;
        else if (price==='paid') query+=` AND c.price>0`;
        query+=` ORDER BY c.featured DESC, c.created_at DESC LIMIT 50`;
        const r = await db.query(query, params);
        return res.json({ success:true, courses:r.rows, total:r.rows.length });
    } catch (err) {
        console.error('[courses] search error:', err);
        return res.status(500).json({ success:false, message:'Search failed', courses:[] });
    }
});

// ─── Enrollment status (authenticated) ────────────────────────────────────────

router.get('/enrollment-status/:courseId', isAuthenticated, async (req, res) => {
    try {
        const courseId = parseInt(req.params.courseId);
        if (isNaN(courseId)) return res.status(400).json({ success:false, message:'Invalid course ID' });
        const eR = await db.query(
            'SELECT id,progress,status FROM enrollments WHERE user_id=$1 AND course_id=$2',
            [req.session.userId, courseId]
        );
        return res.json({ success:true, isEnrolled:eR.rows.length>0,
                          progress:eR.rows[0]?.progress||0, status:eR.rows[0]?.status||null });
    } catch (err) {
        return res.status(500).json({ success:false, message:'An internal server error occurred.' });
    }
});

// ─── Enroll (free external course) ────────────────────────────────────────────

router.post('/enroll/free', isAuthenticated, async (req, res) => {
    try {
        const { courseId, courseTitle, externalUrl } = req.body;
        if (!courseId) return res.status(400).json({ success:false, message:'courseId required' });

        let internalCourseId = null;
        const extR = await db.query(
            `SELECT id FROM courses WHERE (external_id=$1 OR id::text=$1) AND published=true LIMIT 1`,
            [String(courseId)]
        ).catch(()=>({rows:[]}));

        if (extR.rows.length) {
            internalCourseId = extR.rows[0].id;
        } else {
            const sysUser = await db.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
            const instructorId = sysUser.rows[0]?.id || 1;
            const newCourse = await db.query(`
                INSERT INTO courses (title,category,level,price,image_url,published,instructor_id,instructor_name,external_id,created_at)
                VALUES ($1,$2,'Beginner',0,$3,true,$4,'NeurowexTech',$5,NOW())
                ON CONFLICT (external_id) DO UPDATE SET title=EXCLUDED.title
                RETURNING id
            `, [courseTitle||'Free Course','Design','/images/course-placeholder.jpg',instructorId,String(courseId)])
              .catch(async () => {
                  const ex = await db.query('SELECT id FROM courses WHERE title=$1 AND price=0 LIMIT 1',[courseTitle||'Free Course']);
                  if (ex.rows.length) return ex;
                  return db.query(`INSERT INTO courses (title,category,level,price,image_url,published,instructor_id,instructor_name,created_at)
                      VALUES ($1,'Design','Beginner',0,'/images/course-placeholder.jpg',true,$2,'NeurowexTech',NOW()) RETURNING id`,
                      [courseTitle||'Free Course', instructorId]);
              });
            internalCourseId = newCourse.rows[0]?.id;
        }

        if (!internalCourseId)
            return res.json({ success:false, message:'Could not locate course record' });

        const existing = await db.query(
            'SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',
            [req.session.userId, internalCourseId]
        );
        if (existing.rows.length)
            return res.json({ success:true, alreadyEnrolled:true, message:'Already enrolled', redirect:externalUrl });

        await db.query(
            `INSERT INTO enrollments (user_id,course_id,enrolled_at,progress,status) VALUES ($1,$2,NOW(),0,'active')`,
            [req.session.userId, internalCourseId]
        );
        db.query('UPDATE courses SET enrolled_count=COALESCE(enrolled_count,0)+1 WHERE id=$1', [internalCourseId]).catch(() => {});
        db.query(`INSERT INTO user_activities (user_id,activity,type,created_at) VALUES ($1,$2,'enrollment',NOW())`,
            [req.session.userId, `Enrolled in "${courseTitle||'Free Course'}"`]).catch(()=>{});

        const statsR = await db.query('SELECT COUNT(*) AS total FROM enrollments');
        return res.json({ success:true, message:'Enrolled successfully!', redirect:externalUrl,
                          totalEnrollments:parseInt(statsR.rows[0].total)||0 });
    } catch (err) {
        console.error('[courses] free enroll error:', err);
        return res.status(500).json({ success:false, message:'Enrollment failed. Please try again.' });
    }
});

// ─── Enroll (paid/internal course) ────────────────────────────────────────────

router.post('/enroll', isAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.session.userId;
        if (!courseId) return res.status(400).json({ success:false, message:'Course ID required' });

        const cR = await db.query('SELECT id,title,price FROM courses WHERE id=$1 AND published=true', [courseId]);
        if (!cR.rows.length) return res.status(404).json({ success:false, message:'Course not found' });

        const eR = await db.query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
        if (eR.rows.length)
            return res.json({ success:false, alreadyEnrolled:true,
                              message:'Already enrolled in this course',
                              redirect:`/learn/course/${courseId}/dashboard` });

        await db.query(`INSERT INTO enrollments (user_id,course_id,enrolled_at,progress,status) VALUES ($1,$2,NOW(),0,'active')`, [userId, courseId]);
        db.query('UPDATE courses SET enrolled_count=COALESCE(enrolled_count,0)+1 WHERE id=$1', [courseId]).catch(() => {});
        db.query(`INSERT INTO user_activities (user_id,activity,type,created_at) VALUES ($1,$2,'enrollment',NOW())`,
            [userId, `Enrolled in ${cR.rows[0].title}`]).catch(e=>console.log('[activity log]',e.message));

        const statsR = await db.query('SELECT COUNT(*) as total FROM enrollments');
        return res.json({ success:true, message:'Successfully enrolled!',
                          redirect:`/learn/course/${courseId}/dashboard`,
                          totalEnrollments:parseInt(statsR.rows[0]?.total)||0 });
    } catch (err) {
        console.error('[courses] enroll error:', err);
        return res.status(500).json({ success:false, message:'Enrollment failed. Please try again.' });
    }
});

// ─── Lesson completion ────────────────────────────────────────────────────────

router.post('/lesson/complete', isAuthenticated, async (req, res) => {
    try {
        const { lessonId, courseId } = req.body;
        const userId = req.session.userId;
        if (!lessonId||!courseId) return res.status(400).json({ success:false, message:'Lesson ID and Course ID required' });

        const eR = await db.query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
        if (!eR.rows.length) return res.status(403).json({ success:false, message:'Not enrolled in this course' });

        await db.query(`INSERT INTO user_lesson_progress (user_id,lesson_id,completed,completed_at) VALUES ($1,$2,true,NOW())
            ON CONFLICT (user_id,lesson_id) DO UPDATE SET completed=true, completed_at=NOW()`, [userId, lessonId]);

        const progressR = await db.query(`
            SELECT COUNT(*) AS total, SUM(CASE WHEN ulp.completed THEN 1 ELSE 0 END) AS completed
            FROM course_lessons cl
            JOIN course_modules cm ON cl.module_id=cm.id
            LEFT JOIN user_lesson_progress ulp ON cl.id=ulp.lesson_id AND ulp.user_id=$1
            WHERE cm.course_id=$2
        `, [userId, courseId]);

        const total = parseInt(progressR.rows[0]?.total)||0;
        const done  = parseInt(progressR.rows[0]?.completed)||0;
        const newProgress = total>0 ? Math.round((done/total)*100) : 0;

        await db.query('UPDATE enrollments SET progress=$1 WHERE user_id=$2 AND course_id=$3', [newProgress, userId, courseId]);
        return res.json({ success:true, message:'Lesson marked complete',
                          progress:newProgress, completedLessons:done, total });
    } catch (err) {
        console.error('[courses] lesson complete error:', err);
        return res.status(500).json({ success:false, message:'Failed to update progress' });
    }
});

// ─── Admin: CRUD for courses ──────────────────────────────────────────────────

router.get('/learn/courses', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT c.*, u.username AS instructor_name,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),0) AS enrolled_count
            FROM courses c LEFT JOIN users u ON c.instructor_id=u.id
            ORDER BY c.created_at DESC
        `);
        return res.json({ success:true, courses:r.rows });
    } catch (err) { return res.status(500).json({ success:false, message:'An internal server error occurred.' }); }
});

router.post('/learn/courses', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title,description,category,level,total_duration,price,instructor_name,image_url,published,bestseller,featured } = req.body;
        if (!title) return res.status(400).json({ success:false, message:'Course title required' });
        let instructorId = req.session.userId;
        if (instructor_name) {
            const inst = await db.query('SELECT id FROM users WHERE username ILIKE $1 LIMIT 1', [instructor_name]);
            if (inst.rows.length) instructorId = inst.rows[0].id;
        }
        const r = await db.query(`
            INSERT INTO courses (title,description,category,level,total_duration,price,instructor_id,instructor_name,image_url,published,bestseller,featured,rating,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,NOW()) RETURNING *
        `, [title,description||'',category||'Web Development',level||'Beginner',total_duration||'',
            parseFloat(price)||0,instructorId,instructor_name||req.session.userName||'',
            image_url||'',published!==false,bestseller||false,featured||false]);
        return res.json({ success:true, message:'Course created', course:r.rows[0] });
    } catch (err) { return res.status(500).json({ success:false, message:'An internal server error occurred.' }); }
});

router.put('/learn/courses/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title,description,category,level,price,published,bestseller,featured,image_url,total_duration,instructor_name } = req.body;
        let instructorId;
        if (instructor_name) {
            const inst = await db.query('SELECT id FROM users WHERE username ILIKE $1 LIMIT 1', [instructor_name]);
            if (inst.rows.length) instructorId = inst.rows[0].id;
        }
        const r = await db.query(`
            UPDATE courses SET title=COALESCE($1,title),description=COALESCE($2,description),category=COALESCE($3,category),
             level=COALESCE($4,level),price=COALESCE($5,price),published=COALESCE($6,published),bestseller=COALESCE($7,bestseller),
             featured=COALESCE($8,featured),image_url=COALESCE($9,image_url),total_duration=COALESCE($10,total_duration),
             instructor_id=COALESCE($11,instructor_id),instructor_name=COALESCE($12,instructor_name)
            WHERE id=$13 RETURNING *
        `, [title,description,category,level,price!==undefined?parseFloat(price):null,
            published,bestseller,featured,image_url,total_duration,instructorId||null,instructor_name||null,req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success:false, message:'Course not found' });
        return res.json({ success:true, message:'Course updated', course:r.rows[0] });
    } catch (err) { return res.status(500).json({ success:false, message:'An internal server error occurred.' }); }
});

router.delete('/learn/courses/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM courses WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success:false, message:'Course not found' });
        return res.json({ success:true, message:'Course deleted' });
    } catch (err) { return res.status(500).json({ success:false, message:'An internal server error occurred.' }); }
});

// ─── Admin: Enrollments ────────────────────────────────────────────────────────

router.get('/learn/enrollments', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT e.id,e.enrolled_at,e.progress,e.status,u.username,u.email,c.title AS course_title
            FROM enrollments e JOIN users u ON e.user_id=u.id JOIN courses c ON e.course_id=c.id
            ORDER BY e.enrolled_at DESC
        `);
        return res.json({ success:true, enrollments:r.rows });
    } catch (err) { return res.status(500).json({ success:false, message:'An internal server error occurred.' }); }
});

router.delete('/learn/enrollments/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM enrollments WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success:false, message:'Enrollment not found' });
        return res.json({ success:true, message:'Enrollment removed' });
    } catch (err) { return res.status(500).json({ success:false, message:'An internal server error occurred.' }); }
});

module.exports = router;
