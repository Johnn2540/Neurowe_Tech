// ════════════════════════════════════════════════════════════════════════════
// server.js — NeurowexTech Main Application Server
//
// Stack:  Node.js + Express + Handlebars (HBS) + PostgreSQL (Neon)
// Auth:   Session-based (pg-simple) + Google OAuth2
// Files:  Cloudinary image uploads
// Views:  views/*.hbs  (home, learn, course-dashboard, admin_dashboard, ...)
// ════════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const express         = require('express');
const path            = require('path');
const hbs             = require('hbs');
const session         = require('express-session');
const bcrypt          = require('bcrypt');
const fs              = require('fs');
const { Pool }        = require('pg');
const db              = require('./db/postgres');
const { OAuth2Client} = require('google-auth-library');
const multer          = require('multer');
const cloudinary      = require('cloudinary').v2;

const app  = express();
const PORT = process.env.PORT || 3000;

// Detect Vercel serverless environment so we can skip the app.listen() call
const isVercel = process.env.VERCEL === '1';
if (isVercel) console.log('Running on Vercel — serverless mode');

// Google OAuth2 client — used in /api/auth/google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// ════════════════════════════════════════════════════════════════════════════
// SESSION STORE — PostgreSQL via connect-pg-simple
// Stores encrypted session cookies server-side so they survive restarts.
// ════════════════════════════════════════════════════════════════════════════

// Dedicated pool just for the session store (separate from main db queries)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
});

// Create the session table if it doesn't exist yet (first deploy safety)
pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
        "sid"    varchar NOT NULL COLLATE "default",
        "sess"   json    NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    )
`).catch(e => console.log('Session table note:', e.message));

// Create contacts table if the schema.sql was never run (safe migration)
pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(150) NOT NULL,
        email        VARCHAR(255) NOT NULL,
        phone        VARCHAR(50),
        company      VARCHAR(150),
        project_type VARCHAR(200),
        budget       VARCHAR(100),
        message      TEXT NOT NULL,
        status       VARCHAR(20) DEFAULT 'new',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`).catch(e => console.log('Contacts table note:', e.message));

// Add status column if it was missing on older deployments
pool.query(`
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'new'
`).catch(() => {});

// Mount session middleware with pg store
app.use(session({
    store: new (require('connect-pg-simple')(session))({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
    }),
    secret:            process.env.SESSION_SECRET || 'neurowex_secret_2024',
    resave:            false,   // don't re-save unchanged sessions
    saveUninitialized: false,   // don't create sessions for unauthenticated users
    cookie: {
        secure:   process.env.NODE_ENV === 'production', // HTTPS-only in prod
        httpOnly: true,                                   // not accessible to JS
        maxAge:   1000 * 60 * 60 * 24,                   // 24-hour default
        sameSite: 'lax',
    },
    proxy: true,  // trust Vercel/nginx reverse proxy for secure cookies
}));


// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════

// Serve /public files (CSS, client JS, fonts)
app.use(express.static(path.join(__dirname, 'public')));

// Serve /views/images at /images URL — lets HBS templates reference /images/...
app.use('/images', express.static(path.join(__dirname, 'views/images')));

// Parse URL-encoded form bodies (contact form POST, etc.)
app.use(express.urlencoded({ extended: true }));

// Parse JSON request bodies (all /api/* routes)
app.use(express.json());

// Security headers for every response
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Request logger — development only
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}


// ════════════════════════════════════════════════════════════════════════════
// HANDLEBARS SETUP
// ════════════════════════════════════════════════════════════════════════════

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register all partials from views/partials/ (navbar, footer, etc.)
const partialsPath = path.join(__dirname, 'views/partials');
if (fs.existsSync(partialsPath)) hbs.registerPartials(partialsPath);

// ── HANDLEBARS HELPERS ────────────────────────────────────────────────────

// Format a Date object as "January 1, 2025"
hbs.registerHelper('formatDate', date => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
});

// Format a Date object as "Jan 1, 2025"
hbs.registerHelper('shortDate', date => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
});

// Equality check — used in {{#if (eq a b)}}
hbs.registerHelper('eq',  (a, b) => a === b);
hbs.registerHelper('neq', (a, b) => a !== b);

// Integer increment / decrement — used in list numbering
hbs.registerHelper('inc', value => parseInt(value) + 1);
hbs.registerHelper('dec', value => parseInt(value) - 1);

// Basic arithmetic — {{math price '*' 1.16}} etc.
hbs.registerHelper('math', (lvalue, operator, rvalue) => {
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
    if (isNaN(lvalue) || isNaN(rvalue)) return 0;
    const ops = { '+': lvalue + rvalue, '-': lvalue - rvalue,
                  '*': lvalue * rvalue, '/': lvalue / rvalue };
    return ops[operator] ?? 0;
});

// Multiply two integers — {{multiply width height}}
hbs.registerHelper('multiply', (a, b) => parseInt(a) * parseInt(b));

// Truncate a string to N characters
hbs.registerHelper('truncate', (text, length) => {
    if (!text) return '';
    return String(text).length <= length
        ? text
        : String(text).substring(0, length) + '...';
});

// Truncate to N words
hbs.registerHelper('truncateWords', (text, wordCount) => {
    if (!text) return '';
    const words = String(text).split(' ');
    return words.length <= wordCount
        ? text
        : words.slice(0, wordCount).join(' ') + '...';
});

// Non-block helper — {{#if (contains array value)}}
hbs.registerHelper('contains', function(array, value) {
    if (!array || !Array.isArray(array)) return false;
    return array.indexOf(value) !== -1;
});

// Block helper — {{#ifContains array value}}...{{/ifContains}}
hbs.registerHelper('ifContains', function(array, value, options) {
    if (!array || !Array.isArray(array)) return options.inverse(this);
    return array.indexOf(value) !== -1
        ? options.fn(this)
        : options.inverse(this);
});

// Fallback value — {{default course.image '/images/placeholder.jpg'}}
hbs.registerHelper('default', (value, dv) => value || dv);

// Join an array with a separator — {{join tags ', '}}
hbs.registerHelper('join', (array, sep) =>
    Array.isArray(array) ? array.join(sep || ', ') : '');

hbs.registerHelper('lowercase', str => str ? String(str).toLowerCase() : '');
hbs.registerHelper('uppercase', str => str ? String(str).toUpperCase() : '');

// Star rating string — {{starRating 4.5}} → "★★★★½☆"
hbs.registerHelper('starRating', rating => {
    const full = Math.floor(rating || 0);
    const half = (rating || 0) % 1 >= 0.5;
    let stars = '★'.repeat(full);
    if (half) stars += '½';
    while (stars.replace('½', '').length < 5) stars += '☆';
    return stars;
});

// Conditional comparison block — {{#ifCond a '>' b}}...{{/ifCond}}
hbs.registerHelper('ifCond', function(v1, operator, v2, options) {
    const ops = { '==': v1 == v2, '===': v1 === v2, '!=': v1 != v2,
                  '<': v1 < v2, '<=': v1 <= v2, '>': v1 > v2, '>=': v1 >= v2 };
    return ops[operator] ? options.fn(this) : options.inverse(this);
});

// Serialize any value to JSON — used to seed JS STATE objects in templates:
// e.g.  var courseId = {{{json courseId}}}
// Uses triple-braces {{{...}}} so Handlebars doesn't HTML-escape the output.
hbs.registerHelper('json', value => JSON.stringify(value));

// First character uppercase — {{firstChar userName}} → "J"
hbs.registerHelper('firstChar', function(str) {
    if (!str) return 'N';
    return str.charAt(0).toUpperCase();
});


// ── GLOBAL TEMPLATE LOCALS ─────────────────────────────────────────────────
// These are available in every HBS template without passing explicitly.

app.use((req, res, next) => {
    res.locals.currentYear     = new Date().getFullYear();
    res.locals.companyName     = 'NeurowexTech';
    res.locals.currentPath     = req.path;
    res.locals.isAuthenticated = !!req.session.userId;   // used in navbar partials
    res.locals.userRole        = req.session.userRole  || null;
    res.locals.userName        = req.session.userName  || null;
    res.locals.googleClientId  = process.env.GOOGLE_CLIENT_ID || '';
    next();
});


// ════════════════════════════════════════════════════════════════════════════
// CLOUDINARY IMAGE UPLOAD ROUTES
// All routes require isAuthenticated + isAdmin middleware.
// The cloudinary config exports: upload (multer middleware), uploadToCloudinary,
// deleteFromCloudinary, getPublicIdFromUrl.
// ════════════════════════════════════════════════════════════════════════════

const cloudinaryConfig = require('./config/cloudinary');
const {
    upload,
    uploadToCloudinary,
    deleteFromCloudinary,
    getPublicIdFromUrl,
} = cloudinaryConfig;

// POST /api/upload/course-image
// Receives: multipart/form-data with field "image"
// Returns:  { success, imageUrl, publicId, width, height }
app.post('/api/upload/course-image',
    isAuthenticated, isAdmin,
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No image file provided' });

            const result = await uploadToCloudinary(req.file.buffer, 'courses', {
                transformation: [{ width: 800, height: 500, crop: 'fill' }],
            });

            res.json({
                success:   true,
                imageUrl:  result.secure_url,
                publicId:  result.public_id,
                width:     result.width,
                height:    result.height,
            });
        } catch (err) {
            console.error('Course image upload error:', err);
            res.status(500).json({ success: false, message: err.message || 'Upload failed' });
        }
    }
);

// POST /api/upload/team-image — square crop for team member avatars
app.post('/api/upload/team-image',
    isAuthenticated, isAdmin,
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No image file provided' });

            const result = await uploadToCloudinary(req.file.buffer, 'team', {
                transformation: [{ width: 400, height: 400, crop: 'fill' }],
            });

            res.json({ success: true, imageUrl: result.secure_url, publicId: result.public_id });
        } catch (err) {
            console.error('Team image upload error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// POST /api/upload/project-image — limit crop preserves aspect ratio
app.post('/api/upload/project-image',
    isAuthenticated, isAdmin,
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No image file provided' });

            const result = await uploadToCloudinary(req.file.buffer, 'projects', {
                transformation: [{ width: 800, height: 600, crop: 'limit' }],
            });

            res.json({ success: true, imageUrl: result.secure_url, publicId: result.public_id });
        } catch (err) {
            console.error('Project image upload error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// POST /api/upload/blog-image — standard OG image dimensions
app.post('/api/upload/blog-image',
    isAuthenticated, isAdmin,
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No image file provided' });

            const result = await uploadToCloudinary(req.file.buffer, 'blog', {
                transformation: [{ width: 1200, height: 630, crop: 'fill' }],
            });

            res.json({ success: true, imageUrl: result.secure_url, publicId: result.public_id });
        } catch (err) {
            console.error('Blog image upload error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// DELETE /api/upload/delete — remove an image from Cloudinary by publicId
app.delete('/api/upload/delete',
    isAuthenticated, isAdmin,
    async (req, res) => {
        try {
            const { publicId } = req.body;
            if (!publicId)
                return res.status(400).json({ success: false, message: 'Public ID required' });

            const result = await deleteFromCloudinary(publicId);
            if (result) {
                res.json({ success: true, message: 'Image deleted successfully' });
            } else {
                res.status(500).json({ success: false, message: 'Failed to delete image' });
            }
        } catch (err) {
            console.error('Delete image error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);


// ════════════════════════════════════════════════════════════════════════════
// AUTH GUARDS — reusable middleware
// ════════════════════════════════════════════════════════════════════════════

// isAuthenticated — any logged-in user
// JSON requests get 401; browser requests redirect to /login
function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    if (req.is('application/json'))
        return res.status(401).json({ success: false, message: 'Please sign in to continue' });
    res.redirect('/login');
}

// isAdmin — must be logged in AND have role='admin'
function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === 'admin') return next();
    if (req.is('application/json'))
        return res.status(403).json({ success: false, message: 'Admin access required' });
    res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
    });
}


// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET /sign_up — registration page
// Redirects already-logged-in users to their dashboard
app.get('/sign_up', (req, res) => {
    if (req.session.userId)
        return res.redirect(req.session.userRole === 'admin' ? '/admin_dashboard' : '/user_dashboard');
    res.render('sign_up', {
        title:          'Create Account – NeurowexTech',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    });
});
// Alias
app.get('/signup', (req, res) => res.redirect('/sign_up'));

// GET /login — sign-in page
app.get('/login', (req, res) => {
    if (req.session.userId)
        return res.redirect(req.session.userRole === 'admin' ? '/admin_dashboard' : '/user_dashboard');
    res.render('login', {
        title:          'Sign In – NeurowexTech',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    });
});
app.get('/signin', (req, res) => res.redirect('/login'));

// POST /api/register — full registration with firstName + lastName + username
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, username, email, password } = req.body;
        const fullname = firstName && lastName
            ? `${firstName} ${lastName}`.trim()
            : (req.body.fullname || '');
        const uname = username || fullname;

        if (!fullname || fullname.length < 2)
            return res.status(400).json({ success: false, message: 'Please enter your full name' });
        if (!email || !/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        if (!password || password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username))
            return res.status(400).json({ success: false, message: 'Username must be 3–20 chars (letters, numbers, _)' });

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0)
            return res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });

        const hashed = await bcrypt.hash(password, 10);
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role, is_active, created_at)
             VALUES ($1, $2, $3, 'user', true, NOW())
             RETURNING id, username, email, role`,
            [uname, email.toLowerCase(), hashed]
        );

        res.json({
            success:  true,
            message:  'Account created! Please sign in.',
            redirect: '/login',
            user:     result.rows[0],
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// POST /api/signup — simpler registration (used by admin panel "Add User")
app.post('/api/signup', async (req, res) => {
    try {
        const { fullname, email, password } = req.body;
        if (!fullname || !email || !password || password.length < 6)
            return res.status(400).json({
                success: false,
                message: 'Please fill all fields (password min 6 chars)',
            });

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0)
            return res.status(400).json({ success: false, message: 'Email already registered' });

        const hashed = await bcrypt.hash(password, 10);
        const r = await db.query(
            `INSERT INTO users (username, email, password_hash, role, is_active, created_at)
             VALUES ($1,$2,$3,'user',true,NOW())
             RETURNING id, username, email, role`,
            [fullname, email.toLowerCase(), hashed]
        );

        res.json({
            success:  true,
            message:  'Account created! Please sign in.',
            redirect: '/login',
            user:     r.rows[0],
        });
    } catch (e) {
        console.error('Signup error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /api/login — email + password login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Please enter email and password' });

        const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        if (!result.rows.length)
            return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const user = result.rows[0];
        if (!user.is_active)
            return res.status(401).json({ success: false, message: 'Your account has been deactivated' });
        if (!user.password_hash)
            return res.status(401).json({
                success: false,
                message: 'This account uses Google Sign-In. Please use the Google button.',
            });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ success: false, message: 'Invalid email or password' });

        // Populate session
        req.session.userId    = user.id;
        req.session.userEmail = user.email;
        req.session.userName  = user.username;
        req.session.userRole  = user.role;

        // Extend session to 30 days when "remember me" is checked
        if (rememberMe) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;

        req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ success: false, message: 'Session error' });
            }
            // Update last_login asynchronously — non-blocking
            db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

            res.json({
                success:  true,
                message:  'Signed in!',
                role:     user.role,
                redirect: user.role === 'admin' ? '/admin_dashboard' : '/user_dashboard',
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// POST /api/auth/google — verifies Google ID token from the client-side SDK
app.post('/api/auth/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken)
            return res.status(400).json({ success: false, message: 'No ID token provided' });

        // Verify the token with Google's servers
        const ticket  = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        if (!email)
            return res.status(400).json({ success: false, message: 'No email from Google' });

        // Find or create user record
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        let userRow;

        if (!existing.rows.length) {
            // New Google user — create account
            const r = await db.query(
                `INSERT INTO users (username, email, google_id, role, is_active, created_at)
                 VALUES ($1,$2,$3,'user',true,NOW())
                 RETURNING id, username, email, role`,
                [name, email.toLowerCase(), googleId]
            );
            userRow = r.rows[0];
        } else {
            userRow = existing.rows[0];
            // Link google_id if this user previously signed up with email
            if (!userRow.google_id)
                await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
            if (!userRow.is_active)
                return res.status(401).json({ success: false, message: 'Your account has been deactivated.' });
        }

        req.session.userId    = userRow.id;
        req.session.userEmail = userRow.email;
        req.session.userName  = userRow.username;
        req.session.userRole  = userRow.role;

        req.session.save(err => {
            if (err) return res.status(500).json({ success: false, message: 'Session error' });
            db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userRow.id]).catch(() => {});
            res.json({
                success:  true,
                message:  'Google sign-in successful!',
                redirect: userRow.role === 'admin' ? '/admin_dashboard' : '/user_dashboard',
            });
        });
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(500).json({ success: false, message: 'Authentication failed: ' + err.message });
    }
});

// GET /logout — destroy session and redirect home
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Logout error:', err);
        res.redirect('/');
    });
});

// GET /forgot-password — render forgot-password form
app.get('/forgot-password', (req, res) => {
    res.render('reset-password', { title: 'Forgot Password – NeurowexTech', mode: 'forgot' });
});

// GET /reset-password?token=... — render password reset form
app.get('/reset-password', (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/forgot-password');
    res.render('reset-password', { title: 'Reset Password – NeurowexTech', mode: 'reset', token });
});

// POST /api/forgot-password — generate reset token + log link
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ success: false, message: 'Please enter your email' });

        const user = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        // Always return the same message to prevent email enumeration
        if (!user.rows.length)
            return res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });

        const crypto    = require('crypto');
        const token     = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await db.query(
            `INSERT INTO password_resets (email, token, expires_at) VALUES ($1,$2,$3)
             ON CONFLICT (email) DO UPDATE SET token=$2, expires_at=$3`,
            [email.toLowerCase(), token, expiresAt]
        );

        // Log the reset URL — replace with actual email sending in production
        console.log('Password reset link:',
            `${req.protocol}://${req.get('host')}/reset-password?token=${token}`);

        res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/reset-password — verify token and update password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword || newPassword.length < 6)
            return res.status(400).json({
                success: false, message: 'Password must be at least 6 characters',
            });

        const rec = await db.query(
            'SELECT * FROM password_resets WHERE token=$1 AND expires_at > NOW()',
            [token]
        );
        if (!rec.rows.length)
            return res.status(400).json({
                success: false, message: 'This reset link is invalid or has expired.',
            });

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash=$1 WHERE email=$2',
            [hashed, rec.rows[0].email]);
        await db.query('DELETE FROM password_resets WHERE token=$1', [token]);

        res.json({ success: true, message: 'Password updated! You can now sign in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ════════════════════════════════════════════════════════════════════════════
// DASHBOARDS
// ════════════════════════════════════════════════════════════════════════════

// GET /user_dashboard — logged-in user's personal overview
app.get('/user_dashboard', isAuthenticated, async (req, res) => {
    try {
        const uid = req.session.userId;

        const [userR, statsR, enrollmentsR, recentR] = await Promise.all([
            // User profile record
            db.query(
                'SELECT id, username, email, role, created_at, last_login FROM users WHERE id=$1',
                [uid]
            ),
            // Aggregate project + enrollment stats in one query
            db.query(`
                SELECT
                    (SELECT COUNT(*) FROM projects    WHERE user_id=$1)                          AS total_projects,
                    (SELECT COUNT(*) FROM projects    WHERE user_id=$1 AND status='Completed')   AS completed_projects,
                    (SELECT COUNT(*) FROM projects    WHERE user_id=$1 AND status='In Progress') AS active_projects,
                    (SELECT COUNT(*) FROM enrollments WHERE user_id=$1)                          AS total_enrollments,
                    (SELECT COUNT(*) FROM enrollments WHERE user_id=$1 AND status='active')      AS active_enrollments,
                    (SELECT COALESCE(AVG(progress),0) FROM enrollments WHERE user_id=$1)         AS avg_progress
            `, [uid]),
            // Enrolled courses with instructor info
            db.query(`
                SELECT e.id, e.enrolled_at, e.progress, e.status,
                       c.id AS course_id, c.title, c.category, c.level, c.image_url,
                       c.price, c.total_duration,
                       u.username AS instructor_name
                FROM enrollments e
                JOIN courses c ON e.course_id = c.id
                JOIN users   u ON c.instructor_id = u.id
                WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC
            `, [uid]).catch(() => ({ rows: [] })),
            // Recent activity log (may not exist yet)
            db.query(
                'SELECT * FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8',
                [uid]
            ).catch(() => ({ rows: [] })),
        ]);

        if (!userR.rows.length) {
            // Session references a deleted user — force logout
            req.session.destroy();
            return res.redirect('/login');
        }

        const stats = statsR.rows[0] || {};
        res.render('user_dashboard', {
            title: 'Dashboard – NeurowexTech',
            user: userR.rows[0],
            stats: {
                totalProjects:     parseInt(stats.total_projects)     || 0,
                completedProjects: parseInt(stats.completed_projects) || 0,
                activeProjects:    parseInt(stats.active_projects)    || 0,
                totalEnrollments:  parseInt(stats.total_enrollments)  || 0,
                activeEnrollments: parseInt(stats.active_enrollments) || 0,
                avgProgress:       Math.round(parseFloat(stats.avg_progress) || 0),
            },
            enrollments:    enrollmentsR.rows,
            recentActivity: recentR.rows,
        });
    } catch (err) {
        console.error('User dashboard error:', err);
        res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// GET /admin_dashboard — admin overview with platform-wide counts
app.get('/admin_dashboard', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // Helper — returns 0 if the table doesn't exist yet
        const safeCount = async (sql) => {
            try {
                const r = await db.query(sql);
                return parseInt(r.rows[0].count) || 0;
            } catch (e) {
                console.log('safeCount skip:', e.message);
                return 0;
            }
        };

        const stats = {
            total_users:       await safeCount("SELECT COUNT(*) as count FROM users"),
            total_admins:      await safeCount("SELECT COUNT(*) as count FROM users WHERE role='admin'"),
            active_users:      await safeCount("SELECT COUNT(*) as count FROM users WHERE is_active=true"),
            total_contacts:    await safeCount("SELECT COUNT(*) as count FROM contacts"),
            total_subscribers: await safeCount("SELECT COUNT(*) as count FROM subscribers"),
            total_projects:    await safeCount("SELECT COUNT(*) as count FROM projects"),
            total_courses:     await safeCount("SELECT COUNT(*) as count FROM courses WHERE published=true"),
        };

        res.render('admin_dashboard', {
            title:    'Admin Panel – NeurowexTech',
            stats,
            userName: req.session.userName,
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).render('error', { title: 'Error', message: err.message });
    }
});


// ════════════════════════════════════════════════════════════════════════════
// USER API  — /api/user/*
// ════════════════════════════════════════════════════════════════════════════

// GET /api/user/stats — AJAX stats for the user dashboard widgets
app.get('/api/user/stats', isAuthenticated, async (req, res) => {
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
        res.json({
            success:           true,
            totalProjects:     parseInt(row.total)              || 0,
            completedProjects: parseInt(row.completed)          || 0,
            activeProjects:    parseInt(row.active)             || 0,
            totalEnrollments:  parseInt(row.total_enrollments)  || 0,
            activeEnrollments: parseInt(row.active_enrollments) || 0,
            avgProgress:       parseInt(row.avg_progress)       || 0,
        });
    } catch {
        // Return zeros on any DB error so the UI doesn't break
        res.json({ success: true, totalProjects: 0, completedProjects: 0,
                   activeProjects: 0, totalEnrollments: 0, activeEnrollments: 0, avgProgress: 0 });
    }
});

// GET /api/user/enrollments — the enrolled-courses list used by My Learning page
app.get('/api/user/enrollments', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT e.id, e.enrolled_at, e.progress, e.status,
                   c.id AS course_id, c.title, c.category, c.level,
                   c.image_url, c.price, c.total_duration,
                   u.username AS instructor_name
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            JOIN users   u ON c.instructor_id = u.id
            WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC
        `, [req.session.userId]);
        res.json({ success: true, enrollments: r.rows });
    } catch {
        res.json({ success: true, enrollments: [] });
    }
});

// POST /api/enroll/free
// Records enrollment for a free/external course (e.g. Kings-Learn).
// Creates a lightweight courses row if the course isn't in our DB yet.
// Returns: { success, redirect, totalEnrollments }
app.post('/api/enroll/free', isAuthenticated, async (req, res) => {
    try {
        const { courseId, courseTitle, externalUrl } = req.body;
        if (!courseId)
            return res.status(400).json({ success: false, message: 'courseId required' });

        let internalCourseId = null;

        // Try to find the course by external_id or by numeric id
        const extR = await db.query(
            `SELECT id FROM courses WHERE (external_id=$1 OR id::text=$1) AND published=true LIMIT 1`,
            [String(courseId)]
        ).catch(() => ({ rows: [] }));

        if (extR.rows.length) {
            internalCourseId = extR.rows[0].id;
        } else {
            // Course not in our DB — create a stub record so we can track enrollment
            const sysUser    = await db.query(`SELECT id FROM users WHERE role='admin' LIMIT 1`);
            const instructorId = sysUser.rows[0]?.id || 1;

            const newCourse = await db.query(`
                INSERT INTO courses (title, category, level, price, image_url, published,
                                     instructor_id, instructor_name, external_id, created_at)
                VALUES ($1, $2, 'Beginner', 0, $3, true, $4, 'NeurowexTech', $5, NOW())
                ON CONFLICT (external_id) DO UPDATE SET title=EXCLUDED.title
                RETURNING id
            `, [
                courseTitle || 'Free Course',
                'Design',
                '/images/course-placeholder.jpg',
                instructorId,
                String(courseId),
            ]).catch(async () => {
                // Fallback if external_id column doesn't exist yet
                const existing = await db.query(
                    `SELECT id FROM courses WHERE title=$1 AND price=0 LIMIT 1`,
                    [courseTitle || 'Free Course']
                );
                if (existing.rows.length) return existing;
                return db.query(`
                    INSERT INTO courses (title, category, level, price, image_url, published,
                                         instructor_id, instructor_name, created_at)
                    VALUES ($1,'Design','Beginner',0,'/images/course-placeholder.jpg',true,$2,'NeurowexTech',NOW())
                    RETURNING id
                `, [courseTitle || 'Free Course', instructorId]);
            });
            internalCourseId = newCourse.rows[0]?.id;
        }

        if (!internalCourseId)
            return res.json({ success: false, message: 'Could not locate course record' });

        // Prevent duplicate enrollment
        const existing = await db.query(
            'SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',
            [req.session.userId, internalCourseId]
        );
        if (existing.rows.length)
            return res.json({ success: true, alreadyEnrolled: true, message: 'Already enrolled', redirect: externalUrl });

        // Record enrollment
        await db.query(
            `INSERT INTO enrollments (user_id, course_id, enrolled_at, progress, status)
             VALUES ($1, $2, NOW(), 0, 'active')`,
            [req.session.userId, internalCourseId]
        );

        // Increment enrolled_count counter on the course
        await db.query(
            'UPDATE courses SET enrolled_count = COALESCE(enrolled_count,0)+1 WHERE id=$1',
            [internalCourseId]
        );

        // Log activity (non-critical — table may not exist yet)
        await db.query(
            `INSERT INTO user_activities (user_id, title, description, created_at)
             VALUES ($1, 'Enrolled in course', $2, NOW())`,
            [req.session.userId, `Enrolled in "${courseTitle || 'Free Course'}"`]
        ).catch(() => {});

        // Return fresh total so learn.hbs can update counters
        const statsR = await db.query(`SELECT COUNT(*) AS total_enrollments FROM enrollments`);

        res.json({
            success:          true,
            message:          'Enrolled successfully!',
            redirect:         externalUrl,
            totalEnrollments: parseInt(statsR.rows[0].total_enrollments) || 0,
        });
    } catch (err) {
        console.error('Free enroll error:', err);
        res.status(500).json({ success: false, message: 'Enrollment failed. Please try again.' });
    }
});

// GET /api/user/projects — user's project list
app.get('/api/user/projects', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        res.json({ success: true, projects: r.rows });
    } catch {
        res.json({ success: true, projects: [] });
    }
});

// GET /api/user/activities — paginated activity log
app.get('/api/user/activities', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
            [req.session.userId]
        );
        res.json({ success: true, activities: r.rows });
    } catch {
        res.json({ success: true, activities: [] });
    }
});

// GET /api/user/recent-activity — last 10 activities (used by dashboard widget)
app.get('/api/user/recent-activity', isAuthenticated, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',
            [req.session.userId]
        );
        const acts = r.rows.length ? r.rows : [{
            title:       'Account Created',
            description: 'Your account was set up',
            date:        new Date(),
            type:        'login',
        }];
        res.json({ success: true, activities: acts });
    } catch {
        res.json({ success: true, activities: [{ title: 'Account Created',
            description: 'Your account was set up', date: new Date(), type: 'login' }] });
    }
});

// POST /api/user/request-project — submit a new project request
app.post('/api/user/request-project', isAuthenticated, async (req, res) => {
    try {
        const { name, type, description, budget } = req.body;
        if (!name || !description)
            return res.status(400).json({ success: false, message: 'Name and description required' });

        await db.query(
            `INSERT INTO projects (user_id, name, project_type, description, budget, status, created_at)
             VALUES ($1,$2,$3,$4,$5,'Planning',NOW())`,
            [req.session.userId, name, type || 'Web Development', description, budget || 0]
        ).catch(() => {});

        res.json({ success: true, message: 'Project request submitted!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/user/profile — update display name and email
app.put('/api/user/profile', isAuthenticated, async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !email)
            return res.status(400).json({ success: false, message: 'Name and email required' });
        if (!/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Invalid email' });

        await db.query(
            'UPDATE users SET username=$1, email=$2 WHERE id=$3',
            [name, email.toLowerCase(), req.session.userId]
        );
        // Keep session in sync
        req.session.userName  = name;
        req.session.userEmail = email;

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/user/change-password
app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6)
            return res.status(400).json({
                success: false, message: 'New password must be at least 6 characters',
            });

        const user = await db.query(
            'SELECT password_hash FROM users WHERE id=$1', [req.session.userId]
        );
        if (!user.rows[0].password_hash)
            return res.status(400).json({
                success: false, message: 'Google Sign-In accounts cannot set a password here',
            });

        const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!valid)
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hashed, req.session.userId]);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Users  /api/admin/*
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT id, username, email, role, is_active, created_at, last_login, google_id FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, users: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Promote a user to admin role
app.post('/api/admin/make-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        if (parseInt(userId) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        await db.query("UPDATE users SET role='admin' WHERE id=$1", [userId]);
        res.json({ success: true, message: 'User is now admin' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Demote an admin back to regular user
app.post('/api/admin/remove-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        if (parseInt(userId) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        await db.query("UPDATE users SET role='user' WHERE id=$1", [userId]);
        res.json({ success: true, message: 'Admin privileges removed' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Permanently delete a user account
app.delete('/api/admin/delete-user/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.session.userId)
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        const r = await db.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, message: 'User deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Contacts  /api/contacts/*
// ════════════════════════════════════════════════════════════════════════════

// GET /api/contacts — all messages, newest first, with unread count
app.get('/api/contacts', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT *,
                   CASE WHEN status = 'new' OR status IS NULL THEN true ELSE false END AS is_unread
            FROM contacts
            ORDER BY created_at DESC
        `);
        const unread = r.rows.filter(c => c.is_unread).length;
        res.json({ success: true, contacts: r.rows, unread });
    } catch (err) {
        console.error('GET /api/contacts error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/contacts/:id/read — mark a message as read (removes the "New" badge)
app.patch('/api/contacts/:id/read', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await db.query("UPDATE contacts SET status='read' WHERE id=$1", [req.params.id]);
        res.json({ success: true, message: 'Marked as read' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/contacts/:id/replied — mark a message as replied
app.patch('/api/contacts/:id/replied', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await db.query("UPDATE contacts SET status='replied' WHERE id=$1", [req.params.id]);
        res.json({ success: true, message: 'Marked as replied' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/contacts/:id — permanently remove a message
app.delete('/api/contacts/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM contacts WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Contact not found' });
        res.json({ success: true, message: 'Message deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Subscribers  /api/subscribers/*
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/subscribers', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM subscribers ORDER BY subscribed_at DESC');
        res.json({ success: true, subscribers: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/subscribers/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM subscribers WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Subscriber not found' });
        res.json({ success: true, message: 'Subscriber removed' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Projects  /api/projects/*
// ════════════════════════════════════════════════════════════════════════════

// Public: featured projects shown on homepage
app.get('/api/projects/public', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects WHERE featured=true ORDER BY created_at DESC');
        res.json({ success: true, projects: r.rows });
    } catch { res.json({ success: true, projects: [] }); }
});

app.get('/api/projects/featured', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM projects WHERE featured=true ORDER BY created_at DESC LIMIT 3'
        );
        res.json({ success: true, projects: r.rows });
    } catch { res.json({ success: true, projects: [] }); }
});

// Admin: all projects
app.get('/api/projects', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json({ success: true, projects: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/projects', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name, description, category, year, featured, client_url, tech_stack } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Project name required' });
        const r = await db.query(
            `INSERT INTO projects (name, description, category, year, featured, client_url, tech_stack, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
            [name, description || '', category || 'Web', year || new Date().getFullYear(),
             featured || false, client_url || '', tech_stack || '']
        );
        res.json({ success: true, message: 'Project created', project: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.put('/api/projects/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name, description, category, year, featured, client_url, tech_stack } = req.body;
        const r = await db.query(
            `UPDATE projects SET
             name=COALESCE($1,name), description=COALESCE($2,description),
             category=COALESCE($3,category), year=COALESCE($4,year),
             featured=COALESCE($5,featured), client_url=COALESCE($6,client_url),
             tech_stack=COALESCE($7,tech_stack)
             WHERE id=$8 RETURNING *`,
            [name, description, category, year, featured, client_url, tech_stack, req.params.id]
        );
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Project not found' });
        res.json({ success: true, message: 'Project updated', project: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/projects/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM projects WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Project not found' });
        res.json({ success: true, message: 'Project deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Blog  /api/blog/*
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/blog', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
        res.json({ success: true, posts: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/blog', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title, slug, category, author, excerpt, external_url, published } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title required' });
        // Auto-generate slug from title if not provided
        const finalSlug = slug ||
            title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const r = await db.query(
            `INSERT INTO blog_posts (title, slug, category, author, excerpt, external_url, published, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
            [title, finalSlug, category || 'General', author || 'Admin',
             excerpt || '', external_url || '', published || false]
        );
        res.json({ success: true, message: 'Post created', post: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/blog/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM blog_posts WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Post not found' });
        res.json({ success: true, message: 'Post deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Services  /api/services/*
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/services', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM services ORDER BY id ASC');
        res.json({ success: true, services: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/services', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name, description, icon_class, price } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Service name required' });
        const r = await db.query(
            `INSERT INTO services (name, description, icon_class, price, visible) VALUES ($1,$2,$3,$4,true) RETURNING *`,
            [name, description || '', icon_class || '', price || '']
        );
        res.json({ success: true, message: 'Service added', service: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/services/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM services WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Service not found' });
        res.json({ success: true, message: 'Service deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Testimonials, Team, FAQs, Pricing
// (CRUD pattern identical to Services above)
// ════════════════════════════════════════════════════════════════════════════

// ── Testimonials ──────────────────────────────────────────────
app.get('/api/testimonials', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM testimonials ORDER BY created_at DESC');
        res.json({ success: true, testimonials: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/testimonials', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { client_name, client_role, company, rating, content } = req.body;
        if (!client_name || !content)
            return res.status(400).json({ success: false, message: 'Client name and content required' });
        const r = await db.query(
            `INSERT INTO testimonials (client_name, client_role, company, rating, content, published, created_at)
             VALUES ($1,$2,$3,$4,$5,true,NOW()) RETURNING *`,
            [client_name, client_role || '', company || '', rating || 5, content]
        );
        res.json({ success: true, message: 'Testimonial added', testimonial: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.delete('/api/testimonials/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM testimonials WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Testimonial not found' });
        res.json({ success: true, message: 'Testimonial deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Team ──────────────────────────────────────────────────────
app.get('/api/team', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM team ORDER BY id ASC');
        res.json({ success: true, team: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/team', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name, role, bio, linkedin_url, github_url } = req.body;
        if (!name || !role)
            return res.status(400).json({ success: false, message: 'Name and role required' });
        const r = await db.query(
            `INSERT INTO team (name, role, bio, linkedin_url, github_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [name, role, bio || '', linkedin_url || '', github_url || '']
        );
        res.json({ success: true, message: 'Member added', member: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.delete('/api/team/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM team WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Member not found' });
        res.json({ success: true, message: 'Member removed' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── FAQs ──────────────────────────────────────────────────────
app.get('/api/faqs', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM faqs ORDER BY display_order ASC, id ASC');
        res.json({ success: true, faqs: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/faqs', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { question, answer, order: displayOrder, active } = req.body;
        if (!question || !answer)
            return res.status(400).json({ success: false, message: 'Question and answer required' });
        const r = await db.query(
            `INSERT INTO faqs (question, answer, display_order, active, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
            [question, answer, parseInt(displayOrder) || 1, active !== false]
        );
        res.json({ success: true, message: 'FAQ added', faq: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.put('/api/faqs/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { question, answer, display_order, active } = req.body;
        const r = await db.query(
            `UPDATE faqs SET question=COALESCE($1,question), answer=COALESCE($2,answer),
             display_order=COALESCE($3,display_order), active=COALESCE($4,active) WHERE id=$5 RETURNING *`,
            [question, answer, display_order, active, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'FAQ not found' });
        res.json({ success: true, message: 'FAQ updated', faq: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.delete('/api/faqs/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM faqs WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'FAQ not found' });
        res.json({ success: true, message: 'FAQ deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Pricing ───────────────────────────────────────────────────
app.get('/api/pricing', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM pricing_plans ORDER BY price ASC');
        res.json({ success: true, plans: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/pricing', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name, tier, price, price_label, features, popular } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Plan name required' });
        const featuresArr = Array.isArray(features)
            ? features
            : (features ? String(features).split('\n').filter(Boolean) : []);
        const r = await db.query(
            `INSERT INTO pricing_plans (name, tier, price, price_label, features, popular, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
            [name, tier || '', parseInt(price) || 0,
             price_label || `Kshs ${price}`, JSON.stringify(featuresArr), popular || false]
        );
        res.json({ success: true, message: 'Plan added', plan: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.delete('/api/pricing/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM pricing_plans WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Plan not found' });
        res.json({ success: true, message: 'Plan deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Courses  /api/learn/courses/*
// ════════════════════════════════════════════════════════════════════════════

// GET all courses (admin — includes unpublished)
app.get('/api/learn/courses', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT c.*, u.username AS instructor_name,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),0) AS enrolled_count
            FROM courses c LEFT JOIN users u ON c.instructor_id=u.id
            ORDER BY c.created_at DESC
        `);
        res.json({ success: true, courses: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST — create a new course
app.post('/api/learn/courses', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title, description, category, level, total_duration, price,
                instructor_name, image_url, published, bestseller } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Course title required' });

        // Try to resolve instructor by name; fall back to current admin user
        let instructorId = req.session.userId;
        if (instructor_name) {
            const inst = await db.query(
                'SELECT id FROM users WHERE username ILIKE $1 LIMIT 1', [instructor_name]
            );
            if (inst.rows.length) instructorId = inst.rows[0].id;
        }

        const r = await db.query(
            `INSERT INTO courses (title, description, category, level, total_duration, price,
             instructor_id, instructor_name, image_url, published, bestseller, rating, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,NOW()) RETURNING *`,
            [title, description || '', category || 'Web Development', level || 'Beginner',
             total_duration || '', parseFloat(price) || 0, instructorId,
             instructor_name || req.session.userName || '',
             image_url || '', published !== false, bestseller || false]
        );
        res.json({ success: true, message: 'Course created', course: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT — update an existing course
app.put('/api/learn/courses/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title, description, category, level, price, published, bestseller } = req.body;
        const r = await db.query(
            `UPDATE courses SET
             title=COALESCE($1,title), description=COALESCE($2,description),
             category=COALESCE($3,category), level=COALESCE($4,level),
             price=COALESCE($5,price), published=COALESCE($6,published),
             bestseller=COALESCE($7,bestseller) WHERE id=$8 RETURNING *`,
            [title, description, category, level, price, published, bestseller, req.params.id]
        );
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Course not found' });
        res.json({ success: true, message: 'Course updated', course: r.rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE a course (cascades to enrollments in the DB)
app.delete('/api/learn/courses/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM courses WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Course not found' });
        res.json({ success: true, message: 'Course deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Enrollments  /api/learn/enrollments/*
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/learn/enrollments', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT e.id, e.enrolled_at, e.progress, e.status,
                   u.username, u.email, c.title AS course_title
            FROM enrollments e
            JOIN users   u ON e.user_id   = u.id
            JOIN courses c ON e.course_id = c.id
            ORDER BY e.enrolled_at DESC
        `);
        res.json({ success: true, enrollments: r.rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/learn/enrollments/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM enrollments WHERE id=$1 RETURNING id', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        res.json({ success: true, message: 'Enrollment removed' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Settings  /api/settings
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/settings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM settings WHERE id=1 LIMIT 1');
        res.json({ success: true, settings: r.rows[0] || {} });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.put('/api/settings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { site_name, contact_email, whatsapp_number, location, tagline } = req.body;
        await db.query(
            `INSERT INTO settings (id, site_name, contact_email, whatsapp_number, location, tagline)
             VALUES (1,$1,$2,$3,$4,$5)
             ON CONFLICT (id) DO UPDATE
             SET site_name=$1, contact_email=$2, whatsapp_number=$3, location=$4, tagline=$5`,
            [site_name || 'NeurowexTech', contact_email || '',
             whatsapp_number || '', location || '', tagline || '']
        );
        res.json({ success: true, message: 'Settings saved' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// ADMIN API — Dashboard stats  /api/dashboard/stats
// ════════════════════════════════════════════════════════════════════════════

// Protected stats used by admin_dashboard.hbs charts + stat cards
app.get('/api/dashboard/stats', isAuthenticated, isAdmin, async (req, res) => {
    const safeCount = async (sql) => {
        try { const r = await db.query(sql); return parseInt(r.rows[0].count) || 0; }
        catch { return 0; }
    };

    res.json({ success: true, stats: {
        total_users:       await safeCount("SELECT COUNT(*) as count FROM users"),
        total_admins:      await safeCount("SELECT COUNT(*) as count FROM users WHERE role='admin'"),
        total_projects:    await safeCount("SELECT COUNT(*) as count FROM projects"),
        total_contacts:    await safeCount("SELECT COUNT(*) as count FROM contacts"),
        total_subscribers: await safeCount("SELECT COUNT(*) as count FROM subscribers"),
        total_courses:     await safeCount("SELECT COUNT(*) as count FROM courses WHERE published=true"),
        unread_contacts:   await safeCount("SELECT COUNT(*) as count FROM contacts WHERE status='new' OR status IS NULL"),
    }});
});

// Public stats for learn.hbs live counters — no auth required
app.get('/api/dashboard/public-stats', async (req, res) => {
    const safeCount = async (sql) => {
        try { const r = await db.query(sql); return parseInt(r.rows[0].count) || 0; }
        catch { return 0; }
    };

    res.json({ success: true, stats: {
        total_courses:     await safeCount("SELECT COUNT(*) as count FROM courses WHERE published=true"),
        total_enrollments: await safeCount("SELECT COUNT(*) as count FROM enrollments"),
        total_instructors: await safeCount("SELECT COUNT(DISTINCT instructor_id) as count FROM courses WHERE published=true"),
    }});
});


// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET / — homepage
app.get('/', async (req, res) => {
    try {
        const [featuredR, blogsR] = await Promise.all([
            db.query('SELECT * FROM projects WHERE featured=true ORDER BY created_at DESC LIMIT 6')
              .catch(() => ({ rows: [] })),
            db.query("SELECT * FROM blog_posts WHERE published=true ORDER BY created_at DESC LIMIT 3")
              .catch(() => ({ rows: [] })),
        ]);

        // Format blog dates for display
        const blogs = blogsR.rows.map(p => ({
            ...p,
            created_at: p.created_at
                ? new Date(p.created_at).toLocaleDateString('en-KE', {
                      year: 'numeric', month: 'short', day: 'numeric',
                  })
                : '',
        }));

        res.render('home', {
            title:           'NeurowexTech – Web & Mobile Apps That Actually Ship',
            description:     'Custom web and mobile app development for startups and businesses.',
            featuredProjects: featuredR.rows,
            recentBlogs:     blogs,
        });
    } catch (err) {
        console.error('Home error:', err);
        res.render('home', { title: 'NeurowexTech', featuredProjects: [], recentBlogs: [] });
    }
});

// GET /portfolio — all portfolio projects
app.get('/portfolio', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.render('portfolio', { title: 'Portfolio – NeurowexTech', projects: r.rows });
    } catch { res.render('portfolio', { title: 'Portfolio', projects: [] }); }
});

// GET /portfolio/:id — individual project detail
app.get('/portfolio/:id', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
        if (!r.rows.length)
            return res.status(404).render('404', { title: 'Project Not Found' });
        res.render('portfolio-detail', {
            title:   `${r.rows[0].name} – NeurowexTech`,
            project: r.rows[0],
        });
    } catch (err) { res.status(500).render('error', { title: 'Error', message: err.message }); }
});

// Static pages
app.get('/services',          (req, res) => res.render('services',          { title: 'Services – NeurowexTech' }));
app.get('/contact',           (req, res) => res.render('contact',           { title: 'Contact – NeurowexTech' }));
app.get('/become-instructor', (req, res) => res.render('become_instructor', { title: 'Become an Instructor – NeurowexTech Academy' }));
app.get('/kids-coding',       (req, res) => res.render('kids-coding',       { title: 'Kids & Teen Coding Academy – NeurowexTech' }));
app.get('/learn/fullstack',   (req, res) => res.render('fullstack',         { title: 'Full Stack Software Engineering – NeurowexTech Academy' }));
app.get('/learn/graphic-design', (req, res) => res.render('graphic-design', { title: 'Professional Graphic Design – NeurowexTech Academy' }));
app.get('/learn/ai',          (req, res) => res.render('ai-course',         { title: 'Artificial Intelligence (AI) – NeurowexTech Academy' }));

// POST /contact — contact form submission
app.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, project_type, budget, message, company, services } = req.body;
        const isJson  = req.is('application/json');
        const errors  = [];

        if (!name    || name.trim().length < 2)         errors.push('Please enter your full name');
        if (!email   || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Please enter a valid email');
        if (!message || message.trim().length < 10)     errors.push('Please provide more project details');

        if (errors.length) {
            if (isJson) return res.status(400).json({ success: false, message: errors.join('. ') });
            return res.render('contact', { title: 'Contact', error: errors.join('. '), formData: req.body });
        }

        // Combine checkbox services array or project_type dropdown
        const resolvedType = Array.isArray(services) && services.length
            ? services.join(', ')
            : (project_type || '');

        await db.query(
            `INSERT INTO contacts (name, email, phone, project_type, budget, message, company, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'new',NOW())`,
            [name.trim(), email.trim(), phone || '', resolvedType,
             budget || '', message.trim(), company || '']
        );

        console.log(`[CONTACT] New message from ${name} <${email}> — ${resolvedType}`);

        if (isJson) return res.json({ success: true, message: "Thank you! We'll respond within 24 hours." });
        res.render('contact', { title: 'Contact', success: "Thank you! We'll respond within 24 hours." });
    } catch (err) {
        console.error('Contact POST error:', err.message);
        if (req.is('application/json'))
            return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
        res.render('contact', { title: 'Contact', error: 'Something went wrong. Please try again.', formData: req.body });
    }
});

// GET /blog — published posts list
app.get('/blog', async (req, res) => {
    try {
        const r    = await db.query("SELECT * FROM blog_posts WHERE published=true ORDER BY created_at DESC");
        const posts = r.rows;
        const featuredPost = posts.find(p => p.featured || p.bestseller) || posts[0] || null;
        res.render('blog', { title: 'Blog – NeurowexTech', posts, featuredPost });
    } catch (err) {
        console.error('Blog error:', err);
        res.render('blog', { title: 'Blog', posts: [], featuredPost: null });
    }
});

// GET /blog/:slug — individual blog post with related posts
app.get('/blog/:slug', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM blog_posts WHERE slug=$1 AND published=true', [req.params.slug]
        );
        if (!r.rows.length)
            return res.status(404).render('404', { title: 'Post Not Found' });

        const post    = r.rows[0];
        // Try to find related posts in the same category, fall back to most recent
        const related = await db.query(
            'SELECT * FROM blog_posts WHERE published=true AND id!=$1 AND category=$2 ORDER BY created_at DESC LIMIT 3',
            [post.id, post.category]
        );
        const relatedPosts = related.rows.length
            ? related.rows
            : (await db.query(
                'SELECT * FROM blog_posts WHERE published=true AND id!=$1 ORDER BY created_at DESC LIMIT 3',
                [post.id]
              )).rows;

        res.render('blog-post', {
            title:        `${post.title} – NeurowexTech`,
            post,
            relatedPosts,
        });
    } catch (err) {
        console.error('Blog post error:', err);
        res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// POST /subscribe — newsletter signup with duplicate-email protection
app.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });

        await db.query(
            `INSERT INTO subscribers (email, subscribed_at) VALUES ($1,NOW()) ON CONFLICT (email) DO NOTHING`,
            [email.toLowerCase()]
        );
        res.json({ success: true, message: 'Subscribed successfully! 🎉' });
    } catch (err) {
        console.error('Subscribe error:', err);
        res.status(400).json({ success: false, message: err.message || 'Subscription failed' });
    }
});

// Legal / informational pages
app.get('/about',            (req, res) => res.render('about',            { title: 'About – NeurowexTech' }));
app.get('/privacy-policy',   (req, res) => res.render('privacy-policy',   { title: 'Privacy Policy – NeurowexTech' }));
app.get('/terms-of-service', (req, res) => res.render('terms-of-service', { title: 'Terms of Service – NeurowexTech' }));
app.get('/cookie-policy',    (req, res) => res.render('cookie-policy',    { title: 'Cookie Policy – NeurowexTech' }));


// ════════════════════════════════════════════════════════════════════════════
// LEARNING PLATFORM
// ════════════════════════════════════════════════════════════════════════════

// GET /learn — courses catalogue page (renders learn.hbs)
app.get('/learn', async (req, res) => {
    try {
        const [coursesR, categoriesR, statsR] = await Promise.all([
            db.query(`
                SELECT
                    c.*,
                    COALESCE(u.username, 'NeurowexTech') AS instructor_name,
                    0 AS enrolled_count,
                    0 AS total_lessons,
                    0 AS total_modules
                FROM courses c
                LEFT JOIN users u ON c.instructor_id = u.id
                WHERE c.published = true
                ORDER BY c.featured DESC, c.created_at DESC
            `),
            db.query(`
                SELECT category, COUNT(*) AS course_count
                FROM courses
                WHERE published = true AND category IS NOT NULL
                GROUP BY category ORDER BY category
            `),
            db.query(`
                SELECT
                    (SELECT COUNT(*) FROM courses WHERE published = true)            AS total_courses,
                    (SELECT COUNT(DISTINCT category) FROM courses WHERE published = true) AS total_categories,
                    0 AS total_enrollments,
                    0 AS total_instructors
            `),
        ]);

        const courses    = coursesR.rows    || [];
        const categories = categoriesR.rows || [];
        const stats      = statsR.rows[0]   || {};

        const freeCourses = courses.filter(c => parseFloat(c.price) === 0);
        const paidCourses = courses.filter(c => parseFloat(c.price) >  0);

        // Level counts for filter UI
        const levelCounts = { beginner: 0, intermediate: 0, advanced: 0 };
        courses.forEach(c => {
            if (c.level)
                levelCounts[c.level.toLowerCase()] = (levelCounts[c.level.toLowerCase()] || 0) + 1;
        });

        // Which courses is this user already enrolled in?
        let userEnrollments = [];
        if (req.session.userId) {
            try {
                const enrollR = await db.query(
                    'SELECT course_id FROM enrollments WHERE user_id = $1',
                    [req.session.userId]
                );
                userEnrollments = enrollR.rows.map(e => e.course_id);
            } catch {
                // enrollments table may not exist on first run
            }
        }

        const featuredCourse = courses.find(c => c.bestseller) || courses[0] || null;

        res.render('learn', {
            title:             'NeurowexTech Learn – Practical Skills, Real Results',
            freeCourses,
            paidCourses,
            categories,
            stats,
            featuredCourse,
            beginnerCount:     levelCounts.beginner,
            intermediateCount: levelCounts.intermediate,
            advancedCount:     levelCounts.advanced,
            freeCoursesCount:  freeCourses.length,
            paidCoursesCount:  paidCourses.length,
            userEnrollments,
            // isAuthenticated + userName already set by global middleware
        });
    } catch (err) {
        console.error('Learn error:', err);
        res.render('learn', {
            title: 'NeurowexTech Learn',
            freeCourses: [], paidCourses: [], categories: [],
            stats: {}, featuredCourse: null,
            beginnerCount: 0, intermediateCount: 0, advancedCount: 0,
            freeCoursesCount: 0, paidCoursesCount: 0, userEnrollments: [],
        });
    }
});

// GET /learn/course/:id — public course landing page (course-detail.hbs)
app.get('/learn/course/:id', async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        if (isNaN(courseId))
            return res.status(404).render('404', { title: 'Course Not Found' });

        // Course details + instructor + enrollment count
        const cR = await db.query(`
            SELECT c.*,
                   COALESCE(u.username, 'NeurowexTech') AS instructor_name,
                   u.email AS instructor_email,
                   COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id), 0) AS total_enrolled
            FROM courses c
            LEFT JOIN users u ON c.instructor_id = u.id
            WHERE c.id = $1 AND c.published = true
        `, [courseId]);

        if (!cR.rows.length)
            return res.status(404).render('404', { title: 'Course Not Found' });

        const course = cR.rows[0];

        // Modules with their lessons (for the curriculum table)
        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object(
                           'id',           cl.id,
                           'title',        cl.title,
                           'duration',     cl.duration,
                           'lesson_order', cl.lesson_order,
                           'is_free',      cl.is_free,
                           'video_url',    cl.video_url
                       ) ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL), '[]') AS lessons
            FROM course_modules cm
            LEFT JOIN course_lessons cl ON cm.id = cl.module_id
            WHERE cm.course_id = $1
            GROUP BY cm.id
            ORDER BY cm.module_order
        `, [courseId]);

        const modules      = modulesR.rows;
        const totalLessons = modules.reduce(
            (sum, m) => sum + (m.lessons?.filter(l => l && l.id)?.length || 0), 0
        );

        // Check enrollment status for logged-in user
        let isEnrolled        = false;
        let enrollmentProgress = 0;
        let enrollmentId      = null;

        if (req.session.userId) {
            const eR = await db.query(
                'SELECT id, progress FROM enrollments WHERE user_id=$1 AND course_id=$2',
                [req.session.userId, courseId]
            );
            if (eR.rows.length) {
                isEnrolled         = true;
                enrollmentProgress = eR.rows[0].progress || 0;
                enrollmentId       = eR.rows[0].id;
            }
        }

        // Related courses (same category)
        const relatedR = await db.query(`
            SELECT id, title, category, level, rating, image_url, price
            FROM courses WHERE category=$1 AND id!=$2 AND published=true LIMIT 3
        `, [course.category, courseId]);

        res.render('course-detail', {
            title:             `${course.title} – NeurowexTech Learn`,
            course,
            modules,
            totalLessons,
            isEnrolled,
            enrollmentProgress,
            enrollmentId,
            relatedCourses:    relatedR.rows || [],
            // isAuthenticated + userName from global middleware
        });
    } catch (err) {
        console.error('Course detail error:', err);
        res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// POST /api/enroll — enroll the current user in a course
// Returns: { success, redirect: '/learn/course/:id/dashboard' }
app.post('/api/enroll', isAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId       = req.session.userId;

        if (!courseId)
            return res.status(400).json({ success: false, message: 'Course ID required' });

        const cR = await db.query(
            'SELECT id, title, price FROM courses WHERE id=$1 AND published=true',
            [courseId]
        );
        if (!cR.rows.length)
            return res.status(404).json({ success: false, message: 'Course not found' });

        // Prevent duplicate enrollment
        const eR = await db.query(
            'SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',
            [userId, courseId]
        );
        if (eR.rows.length)
            return res.json({
                success:         false,
                alreadyEnrolled: true,
                message:         'Already enrolled in this course',
                redirect:        `/learn/course/${courseId}/dashboard`,
            });

        await db.query(
            `INSERT INTO enrollments (user_id, course_id, enrolled_at, progress, status)
             VALUES ($1,$2,NOW(),0,'active')`,
            [userId, courseId]
        );

        await db.query(
            'UPDATE courses SET enrolled_count = COALESCE(enrolled_count,0)+1 WHERE id=$1',
            [courseId]
        );

        // Log activity (non-critical)
        try {
            await db.query(
                `INSERT INTO user_activities (user_id, activity, type, date) VALUES ($1,$2,'enrollment',NOW())`,
                [userId, `Enrolled in ${cR.rows[0].title}`]
            );
        } catch (logErr) { console.log('Activity log error:', logErr.message); }

        const statsR = await db.query('SELECT COUNT(*) as total FROM enrollments');

        res.json({
            success:          true,
            message:          'Successfully enrolled!',
            redirect:         `/learn/course/${courseId}/dashboard`,
            totalEnrollments: parseInt(statsR.rows[0]?.total) || 0,
        });
    } catch (err) {
        console.error('Enroll error:', err);
        res.status(500).json({ success: false, message: 'Enrollment failed. Please try again.' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /learn/course/:id/dashboard
//
// This is the COURSE PLAYER route — it renders course-dashboard.hbs.
//
// Variables passed to the template and their purpose:
// ─────────────────────────────────────────────────────────────────────────
//  courseId            (int)    — used in /api/lesson/complete body + certificate link
//  courseTitle         (string) — displayed in sidebar header + browser title
//  courseLevel         (string) — shown in sidebar meta row
//  totalDuration       (string) — shown in sidebar meta row (e.g. "8 hours")
//  totalModules        (int)    — shown in sidebar meta row
//  modules             (array)  — full module/lesson tree with per-lesson:
//                                   .completed (bool) from user_lesson_progress
//                                   .isCurrent (bool) true on the first incomplete lesson
//                                   .completedLessons (int) pre-computed per module
//                                   .totalLessons (int) pre-computed per module
//  progress            (int)    — percentage 0–100; used in ring, cert tab, STATE
//  completedLessons    (int)    — used in sidebar "X / Y lessons" text + STATE
//  totalLessons        (int)    — used in sidebar text, cert tab + STATE
//  currentLessonId     (int)    — seeds JS STATE.currentLessonId on page load
//  currentLessonTitle  (string) — shown in lesson info panel on first load
//  currentLessonDescription (string) — shown in lesson info panel on first load
//  currentVideoUrl     (string) — <iframe src> for the initial lesson video
//  currentModuleTitle  (string) — shown in breadcrumb + lesson tag on first load
//  currentLessonCompleted (bool)— controls which button state to show on first load
//  hasPrevLesson       (bool)   — disables "Previous" arrow if no earlier lesson
//  hasNextLesson       (bool)   — disables "Next" arrow if no later lesson
//  enrolledAt          (Date)   — available if the template wants to show it
// ════════════════════════════════════════════════════════════════════════════

app.get('/learn/course/:id/dashboard', isAuthenticated, async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        const userId   = req.session.userId;

        if (isNaN(courseId)) return res.redirect('/learn');

        // ── 1. Verify the user is enrolled ──────────────────────────────
        const eR = await db.query(`
            SELECT e.*,
                   c.title, c.description, c.image_url, c.category,
                   c.level, c.total_duration
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.user_id=$1 AND e.course_id=$2
        `, [userId, courseId]);

        if (!eR.rows.length)
            // Not enrolled — send to the course landing page
            return res.redirect(`/learn/course/${courseId}`);

        const enrollment = eR.rows[0];

        // ── 2. Fetch modules with lesson progress ────────────────────────
        // user_lesson_progress holds a row per (user_id, lesson_id) when completed.
        // NOTE: course_lessons does NOT have a description column.
        // We pass an empty string so the template data-lesson-desc attribute
        // and STATE.allLessons[].desc are never undefined.
        const modulesR = await db.query(`
            SELECT cm.*,
                   COALESCE(json_agg(
                       json_build_object(
                           'id',           cl.id,
                           'title',        cl.title,
                           'description',  '',
                           'duration',     cl.duration,
                           'lesson_order', cl.lesson_order,
                           'video_url',    cl.video_url,
                           'completed',    COALESCE(ulp.completed, false)
                       ) ORDER BY cl.lesson_order
                   ) FILTER (WHERE cl.id IS NOT NULL), '[]') AS lessons
            FROM course_modules cm
            LEFT JOIN course_lessons cl ON cm.id = cl.module_id
            LEFT JOIN user_lesson_progress ulp
                   ON cl.id = ulp.lesson_id AND ulp.user_id = $1
            WHERE cm.course_id = $2
            GROUP BY cm.id
            ORDER BY cm.module_order
        `, [userId, courseId]);

        const modules = modulesR.rows;

        // ── 3. Build a flat ordered list of all lessons ─────────────────
        // Used to find the current lesson and compute prev/next.
        const allLessons = [];
        modules.forEach(mod => {
            (mod.lessons || []).forEach(lesson => {
                if (lesson && lesson.id) {
                    allLessons.push({ ...lesson, moduleTitle: mod.title, moduleId: mod.id });
                }
            });
        });

        // ── 4. Compute overall progress ─────────────────────────────────
        const totalLessons    = allLessons.length;
        const completedLessons = allLessons.filter(l => l.completed).length;
        const progress        = totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

        // Persist updated progress back to the enrollment row
        if (progress !== enrollment.progress) {
            await db.query(
                'UPDATE enrollments SET progress=$1 WHERE id=$2',
                [progress, enrollment.id]
            );
        }

        // ── 5. Add per-module lesson counts (needed by the sidebar) ─────
        modules.forEach(mod => {
            const validLessons     = (mod.lessons || []).filter(l => l && l.id);
            mod.totalLessons       = validLessons.length;
            mod.completedLessons   = validLessons.filter(l => l.completed).length;
        });

        // ── 6. Determine the "current" lesson ───────────────────────────
        // Rule: first lesson that is NOT completed; if all done, use the last lesson.
        const currentLesson = allLessons.find(l => !l.completed) || allLessons[allLessons.length - 1];
        const currentIdx    = currentLesson ? allLessons.indexOf(currentLesson) : -1;

        // Mark isCurrent on the lessons array so HBS can add the .active class
        modules.forEach(mod => {
            (mod.lessons || []).forEach(lesson => {
                lesson.isCurrent = currentLesson ? lesson.id === currentLesson.id : false;
            });
        });

        // ── 7. Resolve current-lesson template variables ─────────────────
        const currentLessonId          = currentLesson?.id          ?? null;
        const currentLessonTitle       = currentLesson?.title        ?? '';
        const currentLessonDescription = "";  // course_lessons has no description column
        const currentVideoUrl          = currentLesson?.video_url    ?? '';
        const currentModuleTitle       = currentLesson?.moduleTitle  ?? '';
        const currentLessonCompleted   = currentLesson?.completed    ?? false;

        // ── 8. Prev / Next flags for the navigation arrows ───────────────
        const hasPrevLesson = currentIdx > 0;
        const hasNextLesson = currentIdx >= 0 && currentIdx < allLessons.length - 1;

        // ── 9. Render the course player ──────────────────────────────────
        res.render('course-dashboard', {
            title:                    `${enrollment.title} – My Learning`,

            // ── Course meta ──────────────────────────────────────────────
            courseId,
            courseTitle:              enrollment.title,
            courseLevel:              enrollment.level         || 'All Levels',
            totalDuration:            enrollment.total_duration || 'Self-paced',
            totalModules:             modules.length,

            // ── Module / lesson tree ─────────────────────────────────────
            // Each module: { id, title, module_order, totalLessons, completedLessons, lessons[] }
            // Each lesson: { id, title, description, duration, video_url, completed, isCurrent }
            modules,

            // ── Progress numbers ─────────────────────────────────────────
            progress,
            completedLessons,
            totalLessons,

            // ── Current-lesson data (seeds the video player on first load) ──
            currentLessonId,
            currentLessonTitle,
            currentLessonDescription,
            currentVideoUrl,
            currentModuleTitle,
            currentLessonCompleted,

            // ── Navigation arrows ─────────────────────────────────────────
            hasPrevLesson,
            hasNextLesson,

            // ── Misc ──────────────────────────────────────────────────────
            enrolledAt:               enrollment.enrolled_at,
            // currentYear, isAuthenticated, userName come from global middleware
        });
    } catch (err) {
        console.error('Course dashboard error:', err);
        res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// POST /api/lesson/complete
// Body: { lessonId, courseId }
// Returns: { success, progress, completed (count), total (count) }
// Used by the "Mark as Complete" button in course-dashboard.hbs
app.post('/api/lesson/complete', isAuthenticated, async (req, res) => {
    try {
        const { lessonId, courseId } = req.body;
        const userId = req.session.userId;

        if (!lessonId || !courseId)
            return res.status(400).json({ success: false, message: 'Lesson ID and Course ID required' });

        // Guard: confirm enrollment before accepting progress updates
        const eR = await db.query(
            'SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',
            [userId, courseId]
        );
        if (!eR.rows.length)
            return res.status(403).json({ success: false, message: 'Not enrolled in this course' });

        // Upsert progress row (idempotent — safe to call multiple times)
        await db.query(`
            INSERT INTO user_lesson_progress (user_id, lesson_id, completed, completed_at)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET completed=true, completed_at=NOW()
        `, [userId, lessonId]);

        // Re-compute overall progress for this enrollment
        const progressR = await db.query(`
            SELECT
                COUNT(*)                                        AS total,
                SUM(CASE WHEN ulp.completed THEN 1 ELSE 0 END) AS completed
            FROM course_lessons cl
            JOIN course_modules cm ON cl.module_id = cm.id
            LEFT JOIN user_lesson_progress ulp
                   ON cl.id = ulp.lesson_id AND ulp.user_id=$1
            WHERE cm.course_id=$2
        `, [userId, courseId]);

        const total       = parseInt(progressR.rows[0]?.total)     || 0;
        const completed   = parseInt(progressR.rows[0]?.completed) || 0;
        const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Persist updated percentage
        await db.query(
            'UPDATE enrollments SET progress=$1 WHERE user_id=$2 AND course_id=$3',
            [newProgress, userId, courseId]
        );

        res.json({
            success:          true,
            message:          'Lesson marked complete',
            progress:         newProgress,   // 0–100 — used to animate the ring
            completedLessons: completed,      // absolute count — updates sidebar text
            total,                            // total lessons — for STATE.totalLessons
        });
    } catch (err) {
        console.error('Lesson complete error:', err);
        res.status(500).json({ success: false, message: 'Failed to update progress' });
    }
});

// GET /api/courses/search — live search for the learn.hbs filter panel
app.get('/api/courses/search', async (req, res) => {
    try {
        const { q, category, level, price } = req.query;
        let query  = `
            SELECT c.*, COALESCE(u.username,'NeurowexTech') AS instructor_name,
                   COALESCE(e.enrolled_count, 0) AS enrolled_count
            FROM courses c
            LEFT JOIN users u ON c.instructor_id = u.id
            LEFT JOIN (
                SELECT course_id, COUNT(*) as enrolled_count
                FROM enrollments GROUP BY course_id
            ) e ON c.id = e.course_id
            WHERE c.published = true
        `;
        const params = [];
        let i = 1;

        if (q) {
            query += ` AND (c.title ILIKE $${i} OR c.description ILIKE $${i})`;
            params.push(`%${q}%`);
            i++;
        }
        if (category && category !== 'all') {
            query += ` AND c.category = $${i}`;
            params.push(category);
            i++;
        }
        if (level && level !== 'all') {
            query += ` AND c.level = $${i}`;
            params.push(level);
            i++;
        }
        if (price === 'free')      query += ` AND c.price = 0`;
        else if (price === 'paid') query += ` AND c.price > 0`;

        query += ` ORDER BY c.featured DESC, c.created_at DESC LIMIT 50`;

        const r = await db.query(query, params);
        res.json({ success: true, courses: r.rows, total: r.rows.length });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ success: false, message: 'Search failed', courses: [] });
    }
});

// GET /my-learning — user's enrolled courses overview
app.get('/my-learning', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        const r = await db.query(`
            SELECT e.*,
                   c.id            AS course_id,
                   c.title,
                   c.category,
                   c.level,
                   c.image_url,
                   c.description,
                   c.total_duration,
                   COALESCE(u.username,'NeurowexTech') AS instructor_name,
                   COALESCE(ls.lesson_count, 0)         AS total_lessons
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            LEFT JOIN users u ON c.instructor_id = u.id
            LEFT JOIN (
                SELECT course_id, COUNT(*) as lesson_count
                FROM course_lessons GROUP BY course_id
            ) ls ON c.id = ls.course_id
            WHERE e.user_id = $1
            ORDER BY e.enrolled_at DESC
        `, [userId]);

        const enrollments      = r.rows || [];
        const totalEnrolled    = enrollments.length;
        const activeCourses    = enrollments.filter(e => e.status === 'active').length;
        const completedCourses = enrollments.filter(e => e.progress === 100).length;
        const averageProgress  = totalEnrolled > 0
            ? Math.round(enrollments.reduce((s, e) => s + (e.progress || 0), 0) / totalEnrolled)
            : 0;

        res.render('my-learning', {
            title: 'My Learning – NeurowexTech',
            enrollments,
            stats: { totalEnrolled, activeCourses, completedCourses, averageProgress },
        });
    } catch (err) {
        console.error('My learning error:', err);
        res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

// GET /api/enrollment-status/:courseId — AJAX check used by learn.hbs enroll buttons
app.get('/api/enrollment-status/:courseId', isAuthenticated, async (req, res) => {
    try {
        const courseId = parseInt(req.params.courseId);
        if (isNaN(courseId))
            return res.status(400).json({ success: false, message: 'Invalid course ID' });

        const eR = await db.query(
            'SELECT id, progress, status FROM enrollments WHERE user_id=$1 AND course_id=$2',
            [req.session.userId, courseId]
        );

        res.json({
            success:    true,
            isEnrolled: eR.rows.length > 0,
            progress:   eR.rows[0]?.progress || 0,
            status:     eR.rows[0]?.status   || null,
        });
    } catch (err) {
        console.error('Enrollment status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ════════════════════════════════════════════════════════════════════════════
// UTILITY ROUTES
// ════════════════════════════════════════════════════════════════════════════

// Health check — used by Vercel, uptime monitors, etc.
app.get('/health', (req, res) => {
    res.json({
        status:    'OK',
        timestamp: new Date().toISOString(),
        uptime:    process.uptime(),
        env:       process.env.NODE_ENV || 'development',
    });
});

// Quick session inspection — useful during development
app.get('/test-auth', (req, res) => {
    res.json({
        sessionExists:   !!req.session,
        userId:          req.session?.userId,
        userRole:        req.session?.userRole,
        isAuthenticated: !!req.session?.userId,
    });
});

// Development-only debug endpoints
if (process.env.NODE_ENV !== 'production') {
    // Check which env vars are set
    app.get('/debug/env', (req, res) => {
        res.json({
            googleClientId: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
            nodeEnv:        process.env.NODE_ENV,
            hasSessionSecret: !!process.env.SESSION_SECRET,
        });
    });

    // Confirm contact inserts are reaching the DB
    app.get('/debug/contacts', isAuthenticated, isAdmin, async (req, res) => {
        try {
            const r = await db.query(
                'SELECT id, name, email, project_type, status, created_at FROM contacts ORDER BY created_at DESC LIMIT 20'
            );
            res.json({ count: r.rows.length, contacts: r.rows });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}


// ════════════════════════════════════════════════════════════════════════════
// ERROR HANDLERS — must be last
// ════════════════════════════════════════════════════════════════════════════

// 404 — no route matched
app.use((req, res) => {
    res.status(404).render('404', {
        title:   'Page Not Found',
        message: 'The page you are looking for does not exist.',
    });
});

// 500 — unhandled server error
app.use((err, req, res, next) => {
    console.error('Global error:', err.stack);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).render('error', {
        title:   'Server Error',
        message: isDev ? err.message : 'Something went wrong. Please try again later.',
        stack:   isDev ? err.stack   : null,
    });
});


// ════════════════════════════════════════════════════════════════════════════
// START / EXPORT
// On Vercel the file is simply require()'d — no listen() call needed.
// In local dev / self-hosted, we call app.listen().
// ════════════════════════════════════════════════════════════════════════════

module.exports = app;

if (process.env.NODE_ENV !== 'production' || !isVercel) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════╗
║   🚀 NeurowexTech — http://localhost:${port}             ║
║   🔐 Google Sign-In: ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Not configured  '}          ║
║   🌍 Environment:   ${(process.env.NODE_ENV || 'development').padEnd(12)}                 ║
║   Press Ctrl+C to stop                                ║
╚═══════════════════════════════════════════════════════╝`);
    });
}
