// routes/web/services.routes.js
'use strict';

const express = require('express');
const router = express.Router();

// Simplified version without database calls for now
// Services index page
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
    
    res.render('services/index', {
        title: 'Our Services – NeurowexTech',
        services: servicesList,
        currentYear: new Date().getFullYear()
    });
});

// Web Development - Simple version first
router.get('/services/web-development', (req, res) => {
    res.render('services/web_dev', {
        title: 'Web Development Services – NeurowexTech',
        serviceName: 'Web & App Development',
        currentYear: new Date().getFullYear()
    });
});

// Graphic Design
router.get('/services/graphic-design', (req, res) => {
    res.render('services/graphic_design', {
        title: 'Graphic Design & Branding – NeurowexTech',
        serviceName: 'Graphic Design & Branding',
        currentYear: new Date().getFullYear()
    });
});

// SEO
router.get('/services/seo', (req, res) => {
    res.render('services/seo', {
        title: 'SEO & Digital Marketing – NeurowexTech',
        serviceName: 'SEO & Digital Marketing',
        currentYear: new Date().getFullYear()
    });
});

// AI Solutions
router.get('/services/ai-solutions', (req, res) => {
    res.render('services/ai_solutions', {
        title: 'AI Solutions – NeurowexTech',
        serviceName: 'AI Solutions',
        currentYear: new Date().getFullYear()
    });
});

// Cybersecurity
router.get('/services/cybersecurity', (req, res) => {
    res.render('services/cybersecurity', {
        title: 'Cybersecurity Services – NeurowexTech',
        serviceName: 'Cybersecurity',
        currentYear: new Date().getFullYear()
    });
});

// UI/UX Design
router.get('/services/ui-ux', (req, res) => {
    res.render('services/uiux', {
        title: 'UI/UX Design – NeurowexTech',
        serviceName: 'UI/UX Design',
        currentYear: new Date().getFullYear()
    });
});

// E-commerce
router.get('/services/ecommerce', (req, res) => {
    res.render('services/ecommerce', {
        title: 'E-Commerce Solutions – NeurowexTech',
        serviceName: 'E-Commerce Solutions',
        currentYear: new Date().getFullYear()
    });
});

// Analytics
router.get('/services/analytics', (req, res) => {
    res.render('services/analytics', {
        title: 'Data Analytics & Business Intelligence – NeurowexTech',
        serviceName: 'Data Analytics & BI',
        currentYear: new Date().getFullYear()
    });
});

// Social Media
router.get('/services/social-media', (req, res) => {
    res.render('services/social_media', {
        title: 'Social Media & Content Creation – NeurowexTech',
        serviceName: 'Social Media Management',
        currentYear: new Date().getFullYear()
    });
});

// Test route to verify module loads
router.get('/services-test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Services routes are loaded!',
        routes: [
            '/services',
            '/services/web-development',
            '/services/graphic-design',
            '/services/seo',
            '/services/ai-solutions',
            '/services/cybersecurity',
            '/services/ui-ux',
            '/services/ecommerce',
            '/services/analytics',
            '/services/social-media'
        ]
    });
});

module.exports = router;