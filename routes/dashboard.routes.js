// routes/dashboard.routes.js
'use strict';

const { Router }                        = require('express');
const { isAuthenticated, isAdmin, isInstructor } = require('../middleware/auth');
const ctrl                              = require('../controllers/dashboard.controller');

const router = Router();

router.get('/user_dashboard',       isAuthenticated,             ctrl.userDashboard);
router.get('/admin_dashboard',      isAuthenticated, isAdmin,    ctrl.adminDashboard);
router.get('/instructor/dashboard', isAuthenticated, isInstructor, ctrl.instructorDashboard);
router.get('/instructor/course',     isAuthenticated, isInstructor, (req, res) => res.redirect('/instructor/dashboard'));
router.get('/instructor/course/:id', isAuthenticated, isInstructor, ctrl.instructorCoursePage);

module.exports = router;
