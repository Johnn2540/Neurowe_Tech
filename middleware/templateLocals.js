// middleware/templateLocals.js — inject global locals into every HBS render
'use strict';

function templateLocals(req, res, next) {
    res.locals.currentYear     = new Date().getFullYear();
    res.locals.companyName     = 'NeurowexTech';
    res.locals.currentPath     = req.path;
    res.locals.isAuthenticated = !!req.session.userId;
    res.locals.userRole        = req.session.userRole  || null;
    res.locals.userName        = req.session.userName  || null;
    res.locals.googleClientId  = process.env.GOOGLE_CLIENT_ID || '';
    next();
}

module.exports = templateLocals;
