require('dotenv').config();
const express = require('express');
const path = require('path');
const hbs = require('hbs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { Pool } = require('pg');
const db = require('./db/postgres');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== SESSION CONFIGURATION (FIXED FOR RENDER) ==========
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Create sessions table if not exists
pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    )
`).catch(err => console.log('Sessions table already exists or error:', err.message));

// Session configuration - FIXED FOR RENDER
app.use(session({
    store: new (require('connect-pg-simple')(session))({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'neurowex_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true on Render (HTTPS)
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: 'lax'
    },
    proxy: true // Important for Render (behind proxy)
}));

// ========== AUTH MIDDLEWARE ==========
// Check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Check if user is admin
function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === 'admin') {
        return next();
    }
    res.status(403).render('error', { 
        title: 'Access Denied',
        message: 'You do not have permission to access this page.'
    });
}

// ========== HANDLEBARS CONFIGURATION ==========
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory
const partialsPath = path.join(__dirname, 'views/partials');
if (fs.existsSync(partialsPath)) {
    hbs.registerPartials(partialsPath);
}

// ========== HANDLEBARS HELPERS ==========
hbs.registerHelper('formatDate', function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

hbs.registerHelper('shortDate', function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
});

hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

hbs.registerHelper('neq', function(a, b) {
    return a !== b;
});

hbs.registerHelper('inc', function(value) {
    return parseInt(value) + 1;
});

hbs.registerHelper('dec', function(value) {
    return parseInt(value) - 1;
});

hbs.registerHelper('math', function(lvalue, operator, rvalue) {
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
    if (isNaN(lvalue) || isNaN(rvalue)) return 0;
    
    switch (operator) {
        case '+': return lvalue + rvalue;
        case '-': return lvalue - rvalue;
        case '*': return lvalue * rvalue;
        case '/': return lvalue / rvalue;
        default: return 0;
    }
});

hbs.registerHelper('truncate', function(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
});

hbs.registerHelper('truncateWords', function(text, wordCount) {
    if (!text) return '';
    const words = text.split(' ');
    if (words.length <= wordCount) return text;
    return words.slice(0, wordCount).join(' ') + '...';
});

hbs.registerHelper('contains', function(array, value, options) {
    if (!array || !Array.isArray(array)) return options.inverse(this);
    return array.indexOf(value) !== -1 ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper('default', function(value, defaultValue) {
    return value || defaultValue;
});

hbs.registerHelper('join', function(array, separator) {
    if (!array || !Array.isArray(array)) return '';
    return array.join(separator || ', ');
});

hbs.registerHelper('lowercase', function(str) {
    return str ? str.toLowerCase() : '';
});

hbs.registerHelper('uppercase', function(str) {
    return str ? str.toUpperCase() : '';
});

// ========== MIDDLEWARE ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'views/images')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Security headers for production
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Make user data available to all templates
app.use((req, res, next) => {
    res.locals.currentYear = new Date().getFullYear();
    res.locals.companyName = 'Neurowex Tech';
    res.locals.currentPath = req.path;
    res.locals.isAuthenticated = !!req.session.userId;
    res.locals.userRole = req.session.userRole || null;
    res.locals.userName = req.session.userName || null;
    next();
});

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ========== AUTH ROUTES ==========

// Sign Up page
app.get('/sign_up', (req, res) => {
    if (req.session.userId) {
        return res.redirect(req.session.userRole === 'admin' ? '/admin_dashboard' : '/user_dashboard');
    }
    res.render('signup', {
        title: 'Sign Up - Neurowex Tech',
        description: 'Create your Neurowex Tech account'
    });
});

// Sign Up API
app.post('/api/signup', async (req, res) => {
    try {
        const { fullname, email, password } = req.body;
        
        if (!fullname || fullname.length < 2) {
            return res.status(400).json({ success: false, message: 'Please enter your full name' });
        }
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        
        const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role, is_active) 
             VALUES ($1, $2, $3, 'user', true) RETURNING id, username, email, role`,
            [fullname, email.toLowerCase(), hashedPassword]
        );
        
        res.json({ 
            success: true, 
            message: 'Account created successfully! Please sign in.',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// Sign In page
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect(req.session.userRole === 'admin' ? '/admin_dashboard' : '/user_dashboard');
    }
    res.render('signin', {
        title: 'Sign In - Neurowex Tech',
        description: 'Sign in to your Neurowex Tech account'
    });
});

// Sign In API (FIXED FOR RENDER)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please enter email and password' });
        }
        
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        const user = result.rows[0];
        
        if (!user.is_active) {
            return res.status(401).json({ success: false, message: 'Your account has been deactivated.' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.username;
        req.session.userRole = user.role;
        
        // Save session before responding
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ success: false, message: 'Session error' });
            }
            
            db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
            
            if (rememberMe) {
                req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
            }
            
            const redirectUrl = user.role === 'admin' ? '/admin_dashboard' : '/user_dashboard';
            
            res.json({ 
                success: true, 
                message: 'Login successful!',
                role: user.role,
                redirect: redirectUrl
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// Sign Out
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// Forgot Password page
app.get('/forgot-password', (req, res) => {
    res.render('reset-password', {
        title: 'Forgot Password - Neurowex Tech'
    });
});

// Reset Password page
app.get('/reset-password', (req, res) => {
    res.render('reset-password', {
        title: 'Reset Password - Neurowex Tech'
    });
});

// Forgot Password API
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Please enter your email address' });
        }
        
        const user = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        
        if (user.rows.length === 0) {
            return res.json({ success: true, message: 'If an account exists, you will receive a reset link.' });
        }
        
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000);
        
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3',
            [email, resetToken, expiresAt]
        );
        
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
        console.log(`Reset link: ${resetLink}`);
        
        res.json({ 
            success: true, 
            message: 'Password reset link has been sent.',
            demoToken: resetToken
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Reset Password API
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Invalid request' });
        }
        
        const resetRecord = await db.query(
            'SELECT * FROM password_resets WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        
        if (resetRecord.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
        }
        
        const email = resetRecord.rows[0].email;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);
        await db.query('DELETE FROM password_resets WHERE token = $1', [token]);
        
        res.json({ success: true, message: 'Password reset successful! Please login.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ========== DASHBOARD ROUTES ==========

// User Dashboard
app.get('/user_dashboard', isAuthenticated, async (req, res) => {
    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
        
        res.render('user_dashboard', {
            title: 'User Dashboard - Neurowex Tech',
            user: user.rows[0],
            activePage: 'dashboard'
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { title: 'Error' });
    }
});

// Admin Dashboard
app.get('/admin_dashboard', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await db.query(
            'SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
        );
        
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                (SELECT COUNT(*) FROM contacts) as total_contacts,
                (SELECT COUNT(*) FROM subscribers) as total_subscribers,
                (SELECT COUNT(*) FROM projects) as total_projects
        `);
        
        res.render('admin_dashboard', {
            title: 'Admin Dashboard - Neurowex Tech',
            users: users.rows,
            stats: stats.rows[0],
            activePage: 'dashboard'
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { title: 'Error' });
    }
});

// ========== USER API ROUTES ==========

app.get('/api/user/stats', isAuthenticated, async (req, res) => {
    try {
        res.json({ success: true, totalProjects: 0, completedProjects: 0, activeProjects: 0 });
    } catch (err) {
        res.json({ success: true, totalProjects: 0, completedProjects: 0, activeProjects: 0 });
    }
});

app.get('/api/user/projects', isAuthenticated, async (req, res) => {
    res.json({ success: true, projects: [] });
});

app.get('/api/user/activities', isAuthenticated, async (req, res) => {
    res.json({ success: true, activities: [] });
});

app.get('/api/user/recent-activity', isAuthenticated, async (req, res) => {
    const activities = [
        { title: 'Account Created', description: 'Your account was created', date: new Date(), type: 'login' }
    ];
    res.json({ success: true, activities });
});

app.get('/api/projects/featured', async (req, res) => {
    try {
        const projects = await db.query('SELECT * FROM projects WHERE featured = true LIMIT 3');
        res.json({ success: true, projects: projects.rows });
    } catch (err) {
        res.json({ success: true, projects: [] });
    }
});

app.post('/api/user/request-project', isAuthenticated, async (req, res) => {
    res.json({ success: true, message: 'Project request submitted!' });
});

app.put('/api/user/profile', isAuthenticated, async (req, res) => {
    try {
        const { name, email } = req.body;
        await db.query('UPDATE users SET username = $1, email = $2 WHERE id = $3', [name, email, req.session.userId]);
        req.session.userName = name;
        req.session.userEmail = email;
        res.json({ success: true, message: 'Profile updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
        const isValid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.session.userId]);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== ADMIN API ROUTES ==========

app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await db.query(
            'SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, users: users.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/make-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        if (userId === req.session.userId) {
            return res.status(400).json({ success: false, message: 'You cannot change your own role' });
        }
        await db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
        res.json({ success: true, message: 'User is now an admin' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/remove-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        if (userId === req.session.userId) {
            return res.status(400).json({ success: false, message: 'You cannot change your own role' });
        }
        await db.query('UPDATE users SET role = $1 WHERE id = $2', ['user', userId]);
        res.json({ success: true, message: 'Admin privileges removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/admin/delete-user/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        if (parseInt(userId) === req.session.userId) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
        }
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/contacts', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const contacts = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
        res.json({ contacts: contacts.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/subscribers', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const subscribers = await db.query('SELECT * FROM subscribers ORDER BY subscribed_at DESC');
        res.json({ subscribers: subscribers.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/projects', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const projects = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json({ projects: projects.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== PUBLIC ROUTES ==========

app.get('/', async (req, res) => {
    try {
        const featuredProjects = await db.getAllProjects(true);
        const recentBlogs = await db.getBlogPosts(true);
        
        res.render('home', {
            title: 'Neurowex Tech - Web & Mobile Apps That Actually Ship',
            description: 'Custom web and mobile app development for startups and businesses.',
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

app.get('/portfolio', async (req, res) => {
    try {
        const projects = await db.getAllProjects(false);
        res.render('portfolio', {
            title: 'Our Portfolio - Neurowex Tech',
            projects: projects || []
        });
    } catch (err) {
        console.error('Portfolio route error:', err);
        res.render('portfolio', { title: 'Portfolio', projects: [] });
    }
});

app.get('/portfolio/:id', async (req, res) => {
    try {
        const project = await db.getProjectById(req.params.id);
        if (!project) {
            return res.status(404).render('404', { title: 'Project Not Found' });
        }
        res.render('portfolio-detail', {
            title: `${project.name} - Neurowex Tech`,
            project
        });
    } catch (err) {
        console.error('Portfolio detail error:', err);
        res.status(500).render('error', { title: 'Error' });
    }
});

app.get('/services', (req, res) => {
    const services = [
        { name: 'Custom Web Apps', icon: '💻', description: 'React, Next.js, Vue applications', price: 'From $5k' },
        { name: 'Mobile App Development', icon: '📱', description: 'iOS & Android with React Native', price: 'From $15k' },
        { name: 'E-commerce Platforms', icon: '🛒', description: 'Custom online stores', price: 'From $10k' },
        { name: 'MVP Package', icon: '🚀', description: 'Launch in 6 weeks', price: '$5k flat' }
    ];
    
    res.render('services', {
        title: 'Our Services - Neurowex Tech',
        services
    });
});

app.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact Us - Neurowex Tech'
    });
});

app.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, project_type, budget, message } = req.body;
        
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
            error: 'Something went wrong. Please try again.',
            formData: req.body
        });
    }
});

app.get('/blog', async (req, res) => {
    try {
        const posts = await db.getBlogPosts(true);
        res.render('blog', {
            title: 'Blog - Neurowex Tech',
            posts: posts || []
        });
    } catch (err) {
        console.error('Blog route error:', err);
        res.render('blog', { title: 'Blog', posts: [] });
    }
});

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

app.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        }
        
        await db.addSubscriber(email);
        res.json({ success: true, message: 'Subscribed successfully!' });
    } catch (err) {
        console.error('Newsletter error:', err);
        res.status(400).json({ success: false, message: err.message || 'Subscription failed.' });
    }
});

app.get('/about', (req, res) => {
    res.render('about', {
        title: 'About Neurowex Tech'
    });
});

// Test auth endpoint for debugging
app.get('/test-auth', (req, res) => {
    res.json({
        sessionExists: !!req.session,
        userId: req.session?.userId,
        userRole: req.session?.userRole,
        isAuthenticated: !!req.session?.userId
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
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
        message: isDev ? err.message : 'Something went wrong. Please try again later.',
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
    ║     📍 Login:  http://localhost:${PORT}/login          ║
    ║     📍 Signup: http://localhost:${PORT}/sign_up        ║
    ║                                                       ║
    ║     🌍 Environment: ${process.env.NODE_ENV || 'development'}    ║
    ║                                                       ║
    ║     Press Ctrl+C to stop the server                   ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);
});