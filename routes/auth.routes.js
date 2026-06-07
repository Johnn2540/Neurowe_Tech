// routes/auth.routes.js
'use strict';

const { Router } = require('express');
const { isAuthenticated } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = Router();

// ── View routes ──────────────────────────────────────────────────────────────

router.get('/sign_up', (req, res) => {
    if (req.session.userId)
        return res.redirect(req.session.userRole === 'admin' ? '/admin_dashboard' : '/user_dashboard');
    res.render('sign_up', {
        title:          'Create Account – NeurowexTech',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    });
});
router.get('/signup', (req, res) => res.redirect('/sign_up'));

router.get('/login', (req, res) => {
    if (req.session.userId)
        return res.redirect(req.session.userRole === 'admin' ? '/admin_dashboard' : '/user_dashboard');
    res.render('login', {
        title:          'Sign In – NeurowexTech',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    });
});
router.get('/signin', (req, res) => res.redirect('/login'));

router.get('/forgot-password', (req, res) =>
    res.render('reset-password', { title: 'Forgot Password – NeurowexTech', mode: 'forgot' }));

router.get('/reset-password', (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/forgot-password');
    res.render('reset-password', { title: 'Reset Password – NeurowexTech', mode: 'reset', token });
});

router.get('/logout', ctrl.logout);

// ── API routes ───────────────────────────────────────────────────────────────

router.post('/api/register',          ctrl.register);
router.post('/api/signup',            ctrl.register);       // alias
router.post('/api/login',             ctrl.login);
router.post('/api/auth/google',       ctrl.googleAuth);
router.post('/api/forgot-password',   ctrl.forgotPassword);
router.post('/api/reset-password',    ctrl.resetPassword);

module.exports = router;
