// routes/web/services.routes.js
'use strict';

const express = require('express');
const router = express.Router();

// ========== REDIRECTS for old URLs to maintain backward compatibility ==========
router.get('/graphic_design', (req, res) => res.redirect(301, '/services/graphic-design'));
router.get('/web_dev', (req, res) => res.redirect(301, '/services/web-development'));
router.get('/ai-solutions', (req, res) => res.redirect(301, '/services/ai-solutions'));
router.get('/cybersecurity', (req, res) => res.redirect(301, '/services/cybersecurity'));
router.get('/uiux', (req, res) => res.redirect(301, '/services/ui-ux'));
router.get('/ecommerce', (req, res) => res.redirect(301, '/services/ecommerce'));
router.get('/analytics', (req, res) => res.redirect(301, '/services/analytics'));
router.get('/social-media', (req, res) => res.redirect(301, '/services/social-media'));

// ========== SERVICES INDEX PAGE ==========
router.get('/services', (req, res) => {
    const servicesList = [
        { name: 'Web Development', slug: 'web-development', icon: 'fas fa-laptop-code', description: 'Modern, scalable web applications', color: '#1a56e8' },
        { name: 'Graphic Design', slug: 'graphic-design', icon: 'fas fa-palette', description: 'Stunning visual identities', color: '#e83a5e' },
        { name: 'SEO & Marketing', slug: 'seo', icon: 'fas fa-chart-line', description: 'Rank higher on search engines', color: '#0dbf7e' },
        { name: 'AI Solutions', slug: 'ai-solutions', icon: 'fas fa-brain', description: 'Intelligent automation', color: '#8b5cf6' },
        { name: 'Cybersecurity', slug: 'cybersecurity', icon: 'fas fa-shield-alt', description: 'Protect your digital assets', color: '#f59e0b' },
        { name: 'UI/UX Design', slug: 'ui-ux', icon: 'fas fa-pencil-ruler', description: 'User-centered design', color: '#06b6d4' },
        { name: 'E-commerce', slug: 'ecommerce', icon: 'fas fa-shopping-cart', description: 'Online stores that sell', color: '#ec4899' },
        { name: 'Data Analytics', slug: 'analytics', icon: 'fas fa-chart-pie', description: 'Data-driven decisions', color: '#6366f1' },
        { name: 'Social Media', slug: 'social-media', icon: 'fas fa-hashtag', description: 'Grow your audience', color: '#14b8a6' }
    ];
    
    // Create a simple services index page since you don't have a dedicated services/index.hbs
    res.render('home', {  // Using home as fallback, or create a services page
        title: 'Our Services – NeurowexTech',
        services: servicesList,
        showServicesOnly: true,
        currentYear: new Date().getFullYear()
    });
});

// ========== INDIVIDUAL SERVICE PAGES ==========
// All your .hbs files are directly in /views folder

// Web Development - maps to web_dev.hbs
router.get('/services/web-development', (req, res) => {
    res.render('web_dev', {  // Direct file in /views
        title: 'Web Development Services – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// Graphic Design - maps to graphic_design.hbs
router.get('/services/graphic-design', (req, res) => {
    res.render('graphic_design', {  // Direct file in /views
        title: 'Graphic Design & Branding – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// SEO - maps to seo.hbs
router.get('/services/seo', (req, res) => {
    res.render('seo', {  // Direct file in /views
        title: 'SEO & Digital Marketing – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// AI Solutions - maps to ai-solutions.hbs (note: filename has hyphen)
router.get('/services/ai-solutions', (req, res) => {
    res.render('ai-solutions', {  // Direct file in /views (ai-solutions.hbs)
        title: 'AI Solutions – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// Cybersecurity - maps to cybersecurity.hbs
router.get('/services/cybersecurity', (req, res) => {
    res.render('cybersecurity', {  // Direct file in /views
        title: 'Cybersecurity Services – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// UI/UX Design - maps to uiux.hbs
router.get('/services/ui-ux', (req, res) => {
    res.render('uiux', {  // Direct file in /views (uiux.hbs)
        title: 'UI/UX Design – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// E-commerce - maps to ecommerce.hbs
router.get('/services/ecommerce', (req, res) => {
    res.render('ecommerce', {  // Direct file in /views
        title: 'E-Commerce Solutions – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// Data Analytics - maps to analytics.hbs
router.get('/services/analytics', (req, res) => {
    res.render('analytics', {  // Direct file in /views
        title: 'Data Analytics & Business Intelligence – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// Social Media - maps to social-media.hbs (note: filename has hyphen)
router.get('/services/social-media', (req, res) => {
    res.render('social-media', {  // Direct file in /views (social-media.hbs)
        title: 'Social Media & Content Creation – NeurowexTech',
        currentYear: new Date().getFullYear()
    });
});

// ========== TEST ROUTE ==========
router.get('/services-test', (req, res) => {
    const fs = require('fs');
    const viewsPath = path.join(__dirname, '../../views');
    
    res.json({ 
        success: true, 
        message: 'Services routes are loaded!',
        templateFiles: {
            web_dev: fs.existsSync(path.join(viewsPath, 'web_dev.hbs')),
            graphic_design: fs.existsSync(path.join(viewsPath, 'graphic_design.hbs')),
            seo: fs.existsSync(path.join(viewsPath, 'seo.hbs')),
            'ai-solutions': fs.existsSync(path.join(viewsPath, 'ai-solutions.hbs')),
            cybersecurity: fs.existsSync(path.join(viewsPath, 'cybersecurity.hbs')),
            uiux: fs.existsSync(path.join(viewsPath, 'uiux.hbs')),
            ecommerce: fs.existsSync(path.join(viewsPath, 'ecommerce.hbs')),
            analytics: fs.existsSync(path.join(viewsPath, 'analytics.hbs')),
            'social-media': fs.existsSync(path.join(viewsPath, 'social-media.hbs'))
        },
        currentYear: new Date().getFullYear()
    });
});

// ========== 404 for undefined service routes ==========
router.get('/services/*', (req, res) => {
    res.status(404).render('404', { 
        title: 'Service Not Found',
        message: 'The service page you are looking for does not exist.'
    });
});

module.exports = router;