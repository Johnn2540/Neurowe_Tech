// routes/api/kids.api.js — /api/kids/* (children management + enrollment + progress)
'use strict';

const { Router }          = require('express');
const { isAuthenticated } = require('../../middleware/auth');
const db                  = require('../../db/postgres');

const router = Router();

// ─── GET /api/kids/children — list parent's children ─────────────────────────

router.get('/children', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            `SELECT id, name, age, avatar_emoji, created_at
             FROM user_children WHERE parent_id=$1 ORDER BY created_at ASC`,
            [req.session.userId]
        );
        return res.json({ success: true, children: r.rows });
    } catch (err) {
        console.error('[kids] request error:', err.message);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// ─── POST /api/kids/children — add a child ────────────────────────────────────

router.post('/children', isAuthenticated, async (req, res) => {
    try {
        const { name, age, avatar_emoji } = req.body;
        if (!name || !String(name).trim())
            return res.status(400).json({ success: false, message: 'Child name is required' });

        const r = await db.query(
            `INSERT INTO user_children (parent_id, name, age, avatar_emoji)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.session.userId, String(name).trim(), parseInt(age) || null, avatar_emoji || '🧒']
        );
        return res.json({ success: true, child: r.rows[0] });
    } catch (err) {
        console.error('[kids] request error:', err.message);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// ─── DELETE /api/kids/children/:id — remove a child ──────────────────────────

router.delete('/children/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid child ID' });
        const r = await db.query(
            `DELETE FROM user_children WHERE id=$1 AND parent_id=$2 RETURNING id`,
            [id, req.session.userId]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Child not found' });
        return res.json({ success: true, message: 'Child removed' });
    } catch (err) {
        console.error('[kids] request error:', err.message);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// ─── POST /api/kids/enroll — enroll a child in a course ──────────────────────

router.post('/enroll', isAuthenticated, async (req, res) => {
    try {
        const { childId, courseId } = req.body;
        const parentId = req.session.userId;
        if (!childId || !courseId)
            return res.status(400).json({ success: false, message: 'childId and courseId are required' });

        // Verify child belongs to this parent
        const childR = await db.query(
            `SELECT id, name FROM user_children WHERE id=$1 AND parent_id=$2`,
            [childId, parentId]
        );
        if (!childR.rows.length)
            return res.status(403).json({ success: false, message: 'Child not found' });

        // Verify course exists and is published
        const courseR = await db.query(
            `SELECT id, title FROM courses WHERE id=$1 AND published=true`,
            [courseId]
        );
        if (!courseR.rows.length)
            return res.status(404).json({ success: false, message: 'Course not found' });

        const child  = childR.rows[0];
        const course = courseR.rows[0];

        // Check if already enrolled
        const existingR = await db.query(
            `SELECT id FROM kids_enrollments WHERE child_id=$1 AND course_id=$2`,
            [childId, courseId]
        );
        if (existingR.rows.length)
            return res.json({
                success:        true,
                alreadyEnrolled: true,
                message:        `${child.name} is already enrolled in this course`,
                redirect:       `/kids-academy/course/${courseId}/learn/${childId}`,
            });

        await db.query(
            `INSERT INTO kids_enrollments (parent_id, child_id, course_id, enrolled_at, progress, status)
             VALUES ($1, $2, $3, NOW(), 0, 'active')`,
            [parentId, childId, courseId]
        );
        db.query(
            `UPDATE courses SET enrolled_count=COALESCE(enrolled_count,0)+1 WHERE id=$1`,
            [courseId]
        ).catch(() => {});

        return res.json({
            success:  true,
            message:  `${child.name} is now enrolled in ${course.title}!`,
            redirect: `/kids-academy/course/${courseId}/learn/${childId}`,
        });
    } catch (err) {
        console.error('[kids] enroll error:', err);
        return res.status(500).json({ success: false, message: 'Enrollment failed. Please try again.' });
    }
});

// ─── GET /api/kids/enrollments — all enrollments for parent's children ────────

router.get('/enrollments', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT ke.id, ke.child_id, ke.course_id, ke.progress, ke.status, ke.enrolled_at,
                   uc.name AS child_name, uc.avatar_emoji,
                   c.title AS course_title, c.image_url, c.category, c.level,
                   COALESCE(u.username, 'NeurowexTech') AS instructor_name
            FROM kids_enrollments ke
            JOIN user_children uc ON ke.child_id = uc.id
            JOIN courses c        ON ke.course_id = c.id
            LEFT JOIN users u     ON c.instructor_id = u.id
            WHERE ke.parent_id = $1
            ORDER BY ke.enrolled_at DESC
        `, [req.session.userId]);
        return res.json({ success: true, enrollments: r.rows });
    } catch (err) {
        console.error('[kids] request error:', err.message);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// ─── POST /api/kids/lesson/complete — mark lesson complete for a child ────────

router.post('/lesson/complete', isAuthenticated, async (req, res) => {
    try {
        const { childId, lessonId, courseId } = req.body;
        const parentId = req.session.userId;
        if (!childId || !lessonId || !courseId)
            return res.status(400).json({ success: false, message: 'childId, lessonId, courseId required' });

        // Verify child ownership
        const childR = await db.query(
            `SELECT id FROM user_children WHERE id=$1 AND parent_id=$2`,
            [childId, parentId]
        );
        if (!childR.rows.length)
            return res.status(403).json({ success: false, message: 'Child not found' });

        // Verify the child is enrolled
        const eR = await db.query(
            `SELECT id FROM kids_enrollments WHERE child_id=$1 AND course_id=$2`,
            [childId, courseId]
        );
        if (!eR.rows.length)
            return res.status(403).json({ success: false, message: 'Child is not enrolled in this course' });

        await db.query(
            `INSERT INTO kids_lesson_progress (child_id, lesson_id, completed, completed_at)
             VALUES ($1, $2, true, NOW())
             ON CONFLICT (child_id, lesson_id) DO UPDATE SET completed=true, completed_at=NOW()`,
            [childId, lessonId]
        );

        // Recalculate overall progress
        const progressR = await db.query(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN klp.completed THEN 1 ELSE 0 END) AS done
            FROM course_lessons cl
            JOIN course_modules cm ON cl.module_id = cm.id
            LEFT JOIN kids_lesson_progress klp
                   ON cl.id = klp.lesson_id AND klp.child_id = $1
            WHERE cm.course_id = $2
        `, [childId, courseId]);

        const total    = parseInt(progressR.rows[0]?.total) || 0;
        const done     = parseInt(progressR.rows[0]?.done)  || 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        await db.query(
            `UPDATE kids_enrollments SET progress=$1 WHERE child_id=$2 AND course_id=$3`,
            [progress, childId, courseId]
        );

        return res.json({ success: true, progress, completedLessons: done, total });
    } catch (err) {
        console.error('[kids] lesson complete error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update progress' });
    }
});

module.exports = router;
