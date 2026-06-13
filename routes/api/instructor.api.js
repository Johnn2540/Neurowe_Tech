// routes/api/instructor.api.js — /api/instructor/*
'use strict';

const { Router }                         = require('express');
const { isAuthenticated, isInstructor }  = require('../../middleware/auth');
const db                                 = require('../../db/postgres');
const { assertCourseAccess }             = require('../services/course.service');

const router = Router();
router.use(isAuthenticated, isInstructor);

// ─── Course update ────────────────────────────────────────────────────────────

router.post('/course/update', async (req, res) => {
    try {
        const { courseId, title, description, level, slug, status,
                price, salePrice, allowFreePreview, certificate,
                imageUrl } = req.body;
        if (!courseId) return res.status(400).json({ success:false, message:'courseId required' });
        await assertCourseAccess(req, courseId);

        const fields=[], vals=[]; let i=1;
        const set = (col,val) => { if (val!==undefined){fields.push(`${col}=$${i++}`); vals.push(val);} };
        set('title',           title);
        set('description',     description);
        set('level',           level);
        set('slug',            slug);
        set('image_url',       imageUrl);
        set('published',       status==='published'?true:status==='draft'?false:undefined);
        set('price',           price!==undefined?parseFloat(price)||0:undefined);
        set('sale_price',      salePrice!==undefined?parseFloat(salePrice)||0:undefined);
        set('allow_free_preview', allowFreePreview);
        set('certificate_enabled', certificate);

        if (!fields.length) return res.json({ success:true, message:'Nothing to update' });
        vals.push(courseId);
        const r = await db.query(`UPDATE courses SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, vals);
        return res.json({ success:true, message:'Course updated', course:r.rows[0] });
    } catch (err) {
        console.error('[instructor] course update error:', err);
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

// ─── Module CRUD ──────────────────────────────────────────────────────────────

router.post('/module/create', async (req, res) => {
    try {
        const { courseId, title } = req.body;
        if (!courseId||!title) return res.status(400).json({ success:false, message:'courseId and title required' });
        await assertCourseAccess(req, courseId);
        const orderR = await db.query(
            'SELECT COALESCE(MAX(module_order),0)+1 AS next_order FROM course_modules WHERE course_id=$1', [courseId]
        );
        const r = await db.query(
            `INSERT INTO course_modules (course_id,title,module_order,created_at) VALUES ($1,$2,$3,NOW()) RETURNING *`,
            [courseId, title.trim(), orderR.rows[0].next_order]
        );
        return res.json({ success:true, message:'Module created', module:r.rows[0] });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

router.post('/module/update', async (req, res) => {
    try {
        const { moduleId, title, order } = req.body;
        if (!moduleId) return res.status(400).json({ success:false, message:'moduleId required' });
        const modR = await db.query('SELECT course_id FROM course_modules WHERE id=$1', [moduleId]);
        if (!modR.rows.length) return res.status(404).json({ success:false, message:'Module not found' });
        await assertCourseAccess(req, modR.rows[0].course_id);
        const r = await db.query(
            `UPDATE course_modules SET title=COALESCE($1,title),module_order=COALESCE($2,module_order) WHERE id=$3 RETURNING *`,
            [title?.trim()||null, order?parseInt(order):null, moduleId]
        );
        return res.json({ success:true, message:'Module updated', module:r.rows[0] });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

router.post('/module/delete', async (req, res) => {
    try {
        const { moduleId } = req.body;
        if (!moduleId) return res.status(400).json({ success:false, message:'moduleId required' });
        const modR = await db.query('SELECT course_id FROM course_modules WHERE id=$1', [moduleId]);
        if (!modR.rows.length) return res.status(404).json({ success:false, message:'Module not found' });
        await assertCourseAccess(req, modR.rows[0].course_id);
        await db.query('DELETE FROM course_lessons WHERE module_id=$1', [moduleId]);
        await db.query('DELETE FROM course_modules WHERE id=$1', [moduleId]);
        return res.json({ success:true, message:'Module deleted' });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

router.post('/module/reorder', async (req, res) => {
    try {
        const { courseId, moduleIds } = req.body;
        if (!courseId||!Array.isArray(moduleIds))
            return res.status(400).json({ success:false, message:'courseId and moduleIds[] required' });
        await assertCourseAccess(req, courseId);
        await Promise.all(moduleIds.map((id,idx) =>
            db.query('UPDATE course_modules SET module_order=$1 WHERE id=$2 AND course_id=$3', [idx+1, id, courseId])
        ));
        return res.json({ success:true, message:'Modules reordered' });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

// ─── Lesson CRUD ──────────────────────────────────────────────────────────────

router.post('/lesson/create', async (req, res) => {
    try {
        const { moduleId, title, videoUrl, duration, isPublished, isFree,
                cloudinaryPublicId, attachmentUrl, attachmentName, attachmentPublicId } = req.body;
        if (!moduleId||!title) return res.status(400).json({ success:false, message:'moduleId and title required' });
        const modR = await db.query('SELECT course_id FROM course_modules WHERE id=$1', [moduleId]);
        if (!modR.rows.length) return res.status(404).json({ success:false, message:'Module not found' });
        await assertCourseAccess(req, modR.rows[0].course_id);
        const orderR = await db.query(
            'SELECT COALESCE(MAX(lesson_order),0)+1 AS next_order FROM course_lessons WHERE module_id=$1', [moduleId]
        );
        const r = await db.query(`
            INSERT INTO course_lessons
              (module_id,title,video_url,duration,lesson_order,is_published,is_free,
               cloudinary_public_id,attachment_url,attachment_name,attachment_public_id,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *
        `, [moduleId, title.trim(), videoUrl||'', duration||'', orderR.rows[0].next_order,
            isPublished!==false, isFree||false,
            cloudinaryPublicId||null, attachmentUrl||null, attachmentName||null, attachmentPublicId||null]);
        return res.json({ success:true, message:'Lesson created', lesson:r.rows[0] });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

router.post('/lesson/update', async (req, res) => {
    try {
        const { lessonId, title, videoUrl, duration, isPublished, isFree,
                cloudinaryPublicId, attachmentUrl, attachmentName, attachmentPublicId } = req.body;
        if (!lessonId) return res.status(400).json({ success:false, message:'lessonId required' });
        const lesR = await db.query(`
            SELECT cl.*, cm.course_id FROM course_lessons cl JOIN course_modules cm ON cl.module_id=cm.id WHERE cl.id=$1
        `, [lessonId]);
        if (!lesR.rows.length) return res.status(404).json({ success:false, message:'Lesson not found' });
        await assertCourseAccess(req, lesR.rows[0].course_id);
        const r = await db.query(`
            UPDATE course_lessons
            SET title=COALESCE($1,title), video_url=COALESCE($2,video_url),
                duration=COALESCE($3,duration), is_published=COALESCE($4,is_published),
                is_free=COALESCE($5,is_free),
                cloudinary_public_id=COALESCE($6,cloudinary_public_id),
                attachment_url=COALESCE($7,attachment_url),
                attachment_name=COALESCE($8,attachment_name),
                attachment_public_id=COALESCE($9,attachment_public_id)
            WHERE id=$10 RETURNING *
        `, [title?.trim()||null, videoUrl??null, duration??null,
            isPublished??null, isFree??null,
            cloudinaryPublicId||null, attachmentUrl||null, attachmentName||null, attachmentPublicId||null,
            lessonId]);
        return res.json({ success:true, message:'Lesson updated', lesson:r.rows[0] });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

router.post('/lesson/delete', async (req, res) => {
    try {
        const { lessonId } = req.body;
        if (!lessonId) return res.status(400).json({ success:false, message:'lessonId required' });
        const lesR = await db.query(
            `SELECT cl.*,cm.course_id FROM course_lessons cl JOIN course_modules cm ON cl.module_id=cm.id WHERE cl.id=$1`, [lessonId]
        );
        if (!lesR.rows.length) return res.status(404).json({ success:false, message:'Lesson not found' });
        await assertCourseAccess(req, lesR.rows[0].course_id);
        await db.query('DELETE FROM user_lesson_progress WHERE lesson_id=$1', [lessonId]);
        await db.query('DELETE FROM course_lessons WHERE id=$1', [lessonId]);
        return res.json({ success:true, message:'Lesson deleted' });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

router.post('/lesson/reorder', async (req, res) => {
    try {
        const { moduleId, lessonIds } = req.body;
        if (!moduleId||!Array.isArray(lessonIds))
            return res.status(400).json({ success:false, message:'moduleId and lessonIds[] required' });
        const modR = await db.query('SELECT course_id FROM course_modules WHERE id=$1', [moduleId]);
        if (!modR.rows.length) return res.status(404).json({ success:false, message:'Module not found' });
        await assertCourseAccess(req, modR.rows[0].course_id);
        await Promise.all(lessonIds.map((id,idx) =>
            db.query('UPDATE course_lessons SET lesson_order=$1 WHERE id=$2 AND module_id=$3', [idx+1, id, moduleId])
        ));
        return res.json({ success:true, message:'Lessons reordered' });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

// ─── Course stats ─────────────────────────────────────────────────────────────

router.get('/course/:id/stats', async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        await assertCourseAccess(req, courseId);
        const [enrollR, progressR, ratingR] = await Promise.all([
            db.query('SELECT COUNT(*) AS total FROM enrollments WHERE course_id=$1', [courseId]),
            db.query(`SELECT COALESCE(AVG(progress),0) AS avg_progress,
                             COUNT(*) FILTER (WHERE progress=100) AS completions
                      FROM enrollments WHERE course_id=$1`, [courseId]),
            db.query(`SELECT COALESCE(AVG(rating),0) AS avg, COUNT(*) AS total
                      FROM course_reviews WHERE course_id=$1`, [courseId])
              .catch(()=>({rows:[{avg:0,total:0}]})),
        ]);
        return res.json({
            success:       true,
            totalEnrolled: parseInt(enrollR.rows[0].total)||0,
            avgProgress:   Math.round(parseFloat(progressR.rows[0].avg_progress)||0),
            completions:   parseInt(progressR.rows[0].completions)||0,
            avgRating:     parseFloat(ratingR.rows[0].avg||0).toFixed(1),
            totalReviews:  parseInt(ratingR.rows[0].total)||0,
        });
    } catch (err) {
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

// ─── Delete course ────────────────────────────────────────────────────────────

router.delete('/course/:id', async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        await assertCourseAccess(req, courseId);

        if (req.session.userRole !== 'admin') {
            const ownerR = await db.query('SELECT instructor_id FROM courses WHERE id=$1', [courseId]);
            if (ownerR.rows[0]?.instructor_id !== req.session.userId)
                return res.status(403).json({ success:false, message:'Only the course owner can delete this course' });
        }

        // Delete all progress, lessons, modules, enrollments in 5 flat queries (no N+1)
        await db.query(`
            DELETE FROM user_lesson_progress
            WHERE lesson_id IN (
                SELECT cl.id FROM course_lessons cl
                JOIN course_modules cm ON cl.module_id = cm.id
                WHERE cm.course_id = $1
            )`, [courseId]);
        await db.query(`DELETE FROM course_lessons WHERE module_id IN (SELECT id FROM course_modules WHERE course_id=$1)`, [courseId]);
        await db.query(`DELETE FROM course_modules WHERE course_id=$1`, [courseId]);
        await db.query(`DELETE FROM enrollments WHERE course_id=$1`, [courseId]);
        await db.query(`DELETE FROM instructor_course_assignments WHERE course_id=$1`, [courseId]);
        await db.query(`DELETE FROM courses WHERE id=$1`, [courseId]);

        return res.json({ success:true, message:'Course deleted' });
    } catch (err) {
        console.error('[instructor] course delete error:', err);
        return res.status(err.status||500).json({ success:false, message:err.message });
    }
});

module.exports = router;
