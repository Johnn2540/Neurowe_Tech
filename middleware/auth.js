// middleware/auth.js — isAuthenticated, isAdmin, isInstructor guards
'use strict';

const { ROLES } = require('../config/constants');

/**
 * Require a logged-in session.
 * JSON requests get 401; browser requests are redirected to /login.
 */
function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    if (req.is('application/json'))
        return res.status(401).json({ success: false, message: 'Please sign in to continue' });
    return res.redirect('/login');
}

/**
 * Require admin role.
 * Must be used after isAuthenticated.
 */
function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === ROLES.ADMIN) return next();
    if (req.is('application/json'))
        return res.status(403).json({ success: false, message: 'Admin access required' });
    return res.status(403).render('error', {
        title:   'Access Denied',
        message: 'You do not have permission to access this page.',
    });
}

/**
 * Require admin OR instructor role.
 * Must be used after isAuthenticated.
 */
function isInstructor(req, res, next) {
    const role = req.session.userRole;
    if (req.session.userId && (role === ROLES.ADMIN || role === ROLES.INSTRUCTOR)) return next();
    if (req.is('application/json'))
        return res.status(403).json({ success: false, message: 'Instructor access required' });
    return res.status(403).render('error', {
        title:   'Access Denied',
        message: 'Instructor or Admin access required.',
    });
}

module.exports = { isAuthenticated, isAdmin, isInstructor };
