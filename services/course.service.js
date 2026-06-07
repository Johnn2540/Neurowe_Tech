// services/course.service.js — shared course business logic
'use strict';

const db = require('../db/postgres');

/**
 * Verifies the current user has access to a course.
 * Admins bypass ownership checks.
 * Returns the course row if allowed; throws an error object with `.status` otherwise.
 *
 * @param {import('express').Request} req
 * @param {number} courseId
 * @returns {Promise<object>} course row
 */
async function assertCourseAccess(req, courseId) {
    if (req.session.userRole === 'admin') {
        const r = await db.query('SELECT * FROM courses WHERE id=$1', [courseId]);
        if (!r.rows.length) throw Object.assign(new Error('Course not found'), { status: 404 });
        return r.rows[0];
    }

    const r = await db.query(`
        SELECT c.* FROM courses c
        WHERE c.id = $1
          AND (
            c.instructor_id = $2
            OR EXISTS (
                SELECT 1 FROM instructor_course_assignments
                WHERE course_id=$1 AND instructor_id=$2
            )
          )
    `, [courseId, req.session.userId]);

    if (!r.rows.length)
        throw Object.assign(new Error('You do not have access to this course'), { status: 403 });

    return r.rows[0];
}

module.exports = { assertCourseAccess };
