// routes/api/user.api.js — /api/user/* and /api/enroll*
'use strict';

const { Router }         = require('express');
const bcrypt             = require('bcryptjs');
const BCRYPT_ROUNDS      = 12;
const { isAuthenticated} = require('../../middleware/auth');
const db                 = require('../../db/postgres');

const router = Router();

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', isAuthenticated, async (req, res) => {
    try {
        const uid = req.session.userId;
        const r = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM projects    WHERE user_id=$1)                          AS total,
                (SELECT COUNT(*) FROM projects    WHERE user_id=$1 AND status='Completed')   AS completed,
                (SELECT COUNT(*) FROM projects    WHERE user_id=$1 AND status='In Progress') AS active,
                (SELECT COUNT(*) FROM enrollments WHERE user_id=$1)                          AS total_enrollments,
                (SELECT COUNT(*) FROM enrollments WHERE user_id=$1 AND status='active')      AS active_enrollments,
                (SELECT COALESCE(ROUND(AVG(progress)),0) FROM enrollments WHERE user_id=$1)  AS avg_progress
        `, [uid]);
        const row = r.rows[0];
        return res.json({
            success:           true,
            totalProjects:     parseInt(row.total)              || 0,
            completedProjects: parseInt(row.completed)          || 0,
            activeProjects:    parseInt(row.active)             || 0,
            totalEnrollments:  parseInt(row.total_enrollments)  || 0,
            activeEnrollments: parseInt(row.active_enrollments) || 0,
            avgProgress:       parseInt(row.avg_progress)       || 0,
        });
    } catch (err) {
        console.error('[user] GET /stats error:', err.message);
        return res.json({ success: true, totalProjects: 0, completedProjects: 0,
                          activeProjects: 0, totalEnrollments: 0, activeEnrollments: 0, avgProgress: 0 });
    }
});

// ─── Enrollments ──────────────────────────────────────────────────────────────

router.get('/enrollments', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT e.id, e.enrolled_at, e.progress, e.status,
                   c.id AS course_id, c.title, c.category, c.level,
                   c.image_url, c.price, c.total_duration,
                   COALESCE(u.username, 'NeurowexTech') AS instructor_name
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            LEFT JOIN users u ON c.instructor_id = u.id
            WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC
        `, [req.session.userId]);
        return res.json({ success: true, enrollments: r.rows });
    } catch (err) {
        console.error('[user] GET /enrollments error:', err.message);
        return res.json({ success: true, enrollments: [] });
    }
});

// ─── Projects ─────────────────────────────────────────────────────────────────

router.get('/projects', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC', [req.session.userId]
        );
        return res.json({ success: true, projects: r.rows });
    } catch (err) {
        console.error('[user] GET /projects error:', err.message);
        return res.json({ success: true, projects: [] });
    }
});

router.post('/request-project', isAuthenticated, async (req, res) => {
    try {
        const { name, type, description, budget } = req.body;
        if (!name || !description)
            return res.status(400).json({ success: false, message: 'Name and description required' });
        await db.query(
            `INSERT INTO projects (user_id, name, project_type, description, budget, status, created_at)
             VALUES ($1,$2,$3,$4,$5,'Planning',NOW())`,
            [req.session.userId, name, type || 'Web Development', description, budget || 0]
        ).catch(e => console.error('[user] project insert error:', e.message));
        return res.json({ success: true, message: 'Project request submitted!' });
    } catch (err) {
        console.error('[user] POST /request-project error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to submit project request. Please try again.' });
    }
});

// ─── Activities ───────────────────────────────────────────────────────────────

router.get('/activities', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
            [req.session.userId]
        );
        return res.json({ success: true, activities: r.rows });
    } catch (err) {
        console.error('[user] GET /activities error:', err.message);
        return res.json({ success: true, activities: [] });
    }
});

router.get('/recent-activity', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',
            [req.session.userId]
        );
        const acts = r.rows.length ? r.rows : [{
            activity: 'Account set up', type: 'system', created_at: new Date(),
        }];
        return res.json({ success: true, activities: acts });
    } catch (err) {
        console.error('[user] GET /recent-activity error:', err.message);
        return res.json({ success: true, activities: [{
            activity: 'Account set up', type: 'system', created_at: new Date(),
        }] });
    }
});

// ─── Profile ──────────────────────────────────────────────────────────────────

router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !email)
            return res.status(400).json({ success: false, message: 'Name and email required' });
        if (!/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Invalid email' });
        await db.query('UPDATE users SET username=$1, email=$2 WHERE id=$3',
            [name, email.toLowerCase(), req.session.userId]);
        req.session.userName  = name;
        req.session.userEmail = email;
        return res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error('[user] PUT /profile error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update profile. Please try again.' });
    }
});

router.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8)
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        const user = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.session.userId]);
        if (!user.rows[0].password_hash)
            return res.status(400).json({ success: false, message: 'Google Sign-In accounts cannot set a password here' });
        const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!valid)
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hashed, req.session.userId]);
        return res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('[user] POST /change-password error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to change password. Please try again.' });
    }
});

module.exports = router;
