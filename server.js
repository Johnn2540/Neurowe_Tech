require('dotenv').config();
const express = require('express');
const path = require('path');
const hbs = require('hbs');
const db = require('./db/postgres');

const app = express();
const PORT = process.env.PORT || 3000;

// ----- Handlebars Configuration -----
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory (create if exists)
const partialsPath = path.join(__dirname, 'views/partials');
const fs = require('fs');
if (fs.existsSync(partialsPath)) {
    hbs.registerPartials(partialsPath);
}

// ========== HANDLEBARS HELPERS ==========
// Date formatting
hbs.registerHelper('formatDate', function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Short date format
hbs.registerHelper('shortDate', function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
});

// Equality check
hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

// Not equal
hbs.registerHelper('neq', function(a, b) {
    return a !== b;
});

// Increment counter (for loops)
hbs.registerHelper('inc', function(value) {
    return parseInt(value) + 1;
});

// Decrement counter
hbs.registerHelper('dec', function(value) {
    return parseInt(value) - 1;
});

// Math operations
hbs.registerHelper('math', function(lvalue, operator, rvalue) {
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
    if (isNaN(lvalue) || isNaN(rvalue)) return 0;
    
    switch (operator) {
        case '+': return lvalue + rvalue;
        case '-': return lvalue - rvalue;
        case '*': return lvalue * rvalue;
        case '/': return lvalue / rvalue;
        case '%': return lvalue % rvalue;
        default: return 0;
    }
});

// Truncate text
hbs.registerHelper('truncate', function(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
});

// Truncate words
hbs.registerHelper('truncateWords', function(text, wordCount) {
    if (!text) return '';
    const words = text.split(' ');
    if (words.length <= wordCount) return text;
    return words.slice(0, wordCount).join(' ') + '...';
});

// JSON stringify (for debugging)
hbs.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

// Check if array contains value
hbs.registerHelper('contains', function(array, value, options) {
    if (!array || !Array.isArray(array)) return options.inverse(this);
    return array.indexOf(value) !== -1 ? options.fn(this) : options.inverse(this);
});

// Default value
hbs.registerHelper('default', function(value, defaultValue) {
    return value || defaultValue;
});

// Join array with separator
hbs.registerHelper('join', function(array, separator) {
    if (!array || !Array.isArray(array)) return '';
    return array.join(separator || ', ');
});

// Lowercase
hbs.registerHelper('lowercase', function(str) {
    return str ? str.toLowerCase() : '';
});

// Uppercase
hbs.registerHelper('uppercase', function(str) {
    return str ? str.toUpperCase() : '';
});

// ----- Middleware -----
// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve images from views/images directory (ADD THIS)
app.use('/images', express.static(path.join(__dirname, 'views/images')));

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Make global data available to all templates
app.use((req, res, next) => {
    res.locals.currentYear = new Date().getFullYear();
    res.locals.companyName = 'Neurowex Tech';
    res.locals.currentPath = req.path;
    next();
});

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ========== ROUTES ==========

// Home page
app.get('/', async (req, res) => {
    try {
        const featuredProjects = await db.getAllProjects(true);
        const recentBlogs = await db.getBlogPosts(true);
        
        res.render('home', {
            title: 'Neurowex Tech - Web & Mobile Apps That Actually Ship',
            description: 'Custom web and mobile app development for startups and businesses. Launch your MVP in weeks, not months.',
            featuredProjects: featuredProjects || [],
            recentBlogs: (recentBlogs || []).slice(0, 3),
            showHero: true,
            showMarquee: true
        });
    } catch (err) {
        console.error('Home route error:', err);
        res.render('home', {
            title: 'Neurowex Tech',
            featuredProjects: [],
            recentBlogs: [],
            showHero: true,
            showMarquee: true
        });
    }
});

// Portfolio listing
app.get('/portfolio', async (req, res) => {
    try {
        const projects = await db.getAllProjects(false);
        res.render('portfolio', {
            title: 'Our Portfolio - Neurowex Tech',
            description: 'Browse our collection of successful web and mobile applications.',
            projects: projects || []
        });
    } catch (err) {
        console.error('Portfolio route error:', err);
        res.render('portfolio', { 
            title: 'Portfolio', 
            projects: [],
            error: 'Unable to load projects. Please try again later.'
        });
    }
});

// Portfolio detail page
app.get('/portfolio/:id', async (req, res) => {
    try {
        const project = await db.getProjectById(req.params.id);
        if (!project) {
            return res.status(404).render('404', { 
                title: 'Project Not Found',
                message: 'The project you\'re looking for doesn\'t exist.'
            });
        }
        res.render('portfolio-detail', {
            title: `${project.name} - Neurowex Tech`,
            description: project.description,
            project
        });
    } catch (err) {
        console.error('Portfolio detail error:', err);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Unable to load project details.'
        });
    }
});

// Services page
app.get('/services', (req, res) => {
    const services = [
        { name: 'Custom Web Apps', icon: '💻', description: 'React, Next.js, Vue applications', price: 'From $5k', features: ['Responsive Design', 'SEO Optimized', 'Fast Performance'] },
        { name: 'Mobile App Development', icon: '📱', description: 'iOS & Android with React Native', price: 'From $15k', features: ['Cross-platform', 'Push Notifications', 'App Store Submission'] },
        { name: 'E-commerce Platforms', icon: '🛒', description: 'Custom online stores', price: 'From $10k', features: ['Payment Integration', 'Inventory Management', 'Analytics'] },
        { name: 'MVP Package', icon: '🚀', description: 'Launch in 6 weeks', price: '$5k flat', features: ['Idea Validation', 'User Testing', 'Quick Launch'] }
    ];
    
    res.render('services', {
        title: 'Our Services - Neurowex Tech',
        description: 'Comprehensive development services for your business needs.',
        services
    });
});

// Contact page (GET)
app.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact Us - Neurowex Tech',
        description: 'Get in touch with our team. We\'d love to hear about your project.'
    });
});

// Contact form (POST)
app.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, project_type, budget, message } = req.body;
        
        // Enhanced validation
        const errors = [];
        if (!name || name.trim().length < 2) errors.push('Please enter your full name');
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Please enter a valid email address');
        if (!message || message.trim().length < 10) errors.push('Please provide more details about your project');
        
        if (errors.length > 0) {
            return res.render('contact', {
                title: 'Contact Us',
                error: errors.join('. '),
                formData: req.body
            });
        }
        
        await db.saveContact({ name, email, phone, project_type, budget, message });
        
        res.render('contact', {
            title: 'Contact Us',
            success: 'Thank you! We\'ll respond within 24 hours.',
            formData: null
        });
    } catch (err) {
        console.error('Contact form error:', err);
        res.render('contact', {
            title: 'Contact Us',
            error: 'Something went wrong. Please try again or email us directly.',
            formData: req.body
        });
    }
});

// Blog listing
app.get('/blog', async (req, res) => {
    try {
        const posts = await db.getBlogPosts(true);
        res.render('blog', {
            title: 'Blog - Neurowex Tech',
            description: 'Insights, tips, and stories from our development team.',
            posts: posts || []
        });
    } catch (err) {
        console.error('Blog route error:', err);
        res.render('blog', { 
            title: 'Blog', 
            posts: [],
            error: 'Unable to load blog posts.'
        });
    }
});

// Single blog post
app.get('/blog/:slug', async (req, res) => {
    try {
        const post = await db.getBlogPostBySlug(req.params.slug);
        if (!post) {
            return res.status(404).render('404', { title: 'Post Not Found' });
        }
        res.render('blog-post', {
            title: `${post.title} - Neurowex Tech Blog`,
            post
        });
    } catch (err) {
        console.error('Blog post error:', err);
        res.status(500).render('error', { title: 'Error' });
    }
});

// Newsletter subscription
app.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        }
        
        await db.addSubscriber(email);
        res.json({ success: true, message: 'Subscribed successfully! Check your inbox.' });
    } catch (err) {
        console.error('Newsletter error:', err);
        res.status(400).json({ success: false, message: err.message || 'Subscription failed. Please try again.' });
    }
});

// About page
app.get('/about', (req, res) => {
    res.render('about', {
        title: 'About Neurowex Tech',
        description: 'Learn about our mission, values, and the team behind Neurowex Tech.'
    });
});

// Health check endpoint (for monitoring)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist or has been moved.'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err.stack);
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).render('error', {
        title: 'Server Error',
        message: isDev ? err.message : 'Something went wrong on our end. Please try again later.',
        stack: isDev ? err.stack : null
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║     🚀 Neurowex Tech Server Running Successfully      ║
    ║                                                       ║
    ║     📍 Local:  http://localhost:${PORT}                 ║
    ║     📍 Home:   http://localhost:${PORT}/               ║
    ║                                                       ║
    ║     📁 Images served from: /views/images              ║
    ║                                                       ║
    ║     Press Ctrl+C to stop the server                   ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);
});