// controllers/auth.controller.js
'use strict';

const bcrypt          = require('bcryptjs');
const crypto          = require('crypto');
const { OAuth2Client} = require('google-auth-library');
const db              = require('../db/postgres');
const { ROLES }       = require('../config/constants');
const { sendResetEmail, sendVerificationEmail } = require('../config/mailer');

const BCRYPT_ROUNDS = 12;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── helpers ────────────────────────────────────────────────────────────────

function redirectForRole(role) {
    if (role === ROLES.ADMIN)       return '/admin_dashboard';
    if (role === ROLES.INSTRUCTOR)  return '/instructor/dashboard';
    return '/user_dashboard';
}

// ─── register ───────────────────────────────────────────────────────────────

async function register(req, res) {
    try {
        const { firstName, lastName, username, email, password, fullname } = req.body;
        const name  = firstName && lastName ? `${firstName} ${lastName}`.trim()
                    : (fullname || username || '');
        // Display name stored as username — never empty, max 100 chars
        const uname = (name || email.split('@')[0]).substring(0, 100);

        if (!name  || name.length < 2)
            return res.status(400).json({ success: false, message: 'Please enter your full name' });
        if (!email || !/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        if (!password || password.length < 8)
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username))
            return res.status(400).json({ success: false, message: 'Username must be 3–20 chars (letters, numbers, _)' });

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length)
            return res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });

        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role, is_active, email_verified, created_at)
             VALUES ($1, $2, $3, 'user', true, false, NOW())
             RETURNING id, username, email, role`,
            [uname, email.toLowerCase(), hashed]
        );
        const newUser = result.rows[0];

        // Generate verification token (24-hour expiry)
        const vToken     = crypto.randomBytes(32).toString('hex');
        const vExpiresAt = new Date(Date.now() + 86_400_000);
        await db.query(
            `INSERT INTO email_verifications (email, token, expires_at) VALUES ($1, $2, $3)
             ON CONFLICT (token) DO NOTHING`,
            [email.toLowerCase(), vToken, vExpiresAt]
        );

        const verifyLink = `${req.protocol}://${req.get('host')}/verify-email?token=${vToken}`;
        try {
            await sendVerificationEmail(email.toLowerCase(), verifyLink, uname);
        } catch (mailErr) {
            console.error('[auth] verification email error:', mailErr.message);
        }

        return res.json({
            success:     true,
            needsVerify: true,
            message:     'Account created! Please check your email to verify your account before signing in.',
            email:       email.toLowerCase(),
        });
    } catch (err) {
        console.error('[auth] register error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
}

// ─── login ──────────────────────────────────────────────────────────────────

async function login(req, res) {
    try {
        const { email, password, rememberMe, next: nextUrl } = req.body;
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

        if (user.email_verified === false)
            return res.status(403).json({
                success:     false,
                needsVerify: true,
                email:       user.email,
                message:     'Please verify your email before signing in. Check your inbox or resend the link.',
            });

        req.session.userId    = user.id;
        req.session.userEmail = user.email;
        req.session.userName  = user.username;
        req.session.userRole  = user.role;

        if (rememberMe) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;

        // Only allow same-origin relative paths as the post-login redirect
        const safeNext = nextUrl
            && typeof nextUrl === 'string'
            && nextUrl.startsWith('/')
            && !nextUrl.startsWith('//')
            ? nextUrl : null;

        req.session.save(err => {
            if (err) {
                console.error('[auth] session save error:', err);
                return res.status(500).json({ success: false, message: 'Session error' });
            }
            db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});
            return res.json({
                success:  true,
                message:  'Signed in!',
                role:     user.role,
                redirect: safeNext || redirectForRole(user.role),
            });
        });
    } catch (err) {
        console.error('[auth] login error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
}

// ─── Google OAuth ────────────────────────────────────────────────────────────

async function googleAuth(req, res) {
    try {
        const idToken = req.body.credential || req.body.idToken;
        if (!idToken)
            return res.status(400).json({ success: false, message: 'No ID token provided' });

        const ticket  = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { email, name, sub: googleId } = ticket.getPayload();
        if (!email)
            return res.status(400).json({ success: false, message: 'No email from Google' });

        const existing = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        let userRow;

        if (!existing.rows.length) {
            const r = await db.query(
                `INSERT INTO users (username, email, google_id, password_hash, role, is_active, email_verified, created_at)
                 VALUES ($1,$2,$3,'','user',true,true,NOW())
                 RETURNING id, username, email, role`,
                [name, email.toLowerCase(), googleId]
            );
            userRow = r.rows[0];
        } else {
            userRow = existing.rows[0];
            if (!userRow.is_active)
                return res.status(401).json({ success: false, message: 'Your account has been deactivated.' });
            if (!userRow.google_id && userRow.email_verified !== false) {
                await db.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, userRow.id]);
            } else if (!userRow.google_id && userRow.email_verified === false) {
                await db.query('UPDATE users SET google_id=$1, email_verified=true WHERE id=$2', [googleId, userRow.id]);
            } else if (userRow.email_verified === false) {
                await db.query('UPDATE users SET email_verified=true WHERE id=$1', [userRow.id]);
            }
        }

        req.session.userId    = userRow.id;
        req.session.userEmail = userRow.email;
        req.session.userName  = userRow.username;
        req.session.userRole  = userRow.role;

        req.session.save(err => {
            if (err) return res.status(500).json({ success: false, message: 'Session error' });
            db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userRow.id]).catch(() => {});
            return res.json({
                success: true,
                message: 'Google sign-in successful!',
                redirect: redirectForRole(userRow.role),
            });
        });
    } catch (err) {
        console.error('[auth] Google auth error:', err);
        return res.status(500).json({ success: false, message: 'Authentication failed. Please try again.' });
    }
}

// ─── logout ─────────────────────────────────────────────────────────────────

function logout(req, res) {
    req.session.destroy(err => {
        if (err) console.error('[auth] logout error:', err);
        res.redirect('/');
    });
}

// ─── password reset ──────────────────────────────────────────────────────────

async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ success: false, message: 'Please enter your email' });

        const user = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        // Always return the same message to prevent email enumeration
        if (!user.rows.length)
            return res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });

        const token     = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3_600_000); // 1 hour

        await db.query(
            `INSERT INTO password_resets (email, token, expires_at) VALUES ($1,$2,$3)
             ON CONFLICT (email) DO UPDATE SET token=$2, expires_at=$3`,
            [email.toLowerCase(), token, expiresAt]
        );

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

        let emailSent = false;
        try {
            emailSent = await sendResetEmail(email.toLowerCase(), resetLink);
        } catch (mailErr) {
            console.error('[auth] email send error:', mailErr.message);
        }

        if (!emailSent) {
            // No SMTP configured — return the link directly so the user can still reset
            console.log('[auth] Password reset link (no SMTP):', resetLink);
            return res.json({
                success:   true,
                resetLink,
                message:   'Email service not configured. Use the link below to reset your password.',
            });
        }

        return res.json({ success: true, message: 'Reset link sent! Check your email inbox (and spam folder).' });
    } catch (err) {
        console.error('[auth] forgot-password error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword || newPassword.length < 8)
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

        const rec = await db.query(
            'SELECT * FROM password_resets WHERE token=$1 AND expires_at > NOW()', [token]
        );
        if (!rec.rows.length)
            return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });

        const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE users SET password_hash=$1 WHERE email=$2', [hashed, rec.rows[0].email]);
        await db.query('DELETE FROM password_resets WHERE token=$1', [token]);

        return res.json({ success: true, message: 'Password updated! You can now sign in.' });
    } catch (err) {
        console.error('[auth] reset-password error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

// ─── resend verification ─────────────────────────────────────────────────────

async function resendVerification(req, res) {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email required' });

        const userR = await db.query(
            'SELECT id, username, email_verified FROM users WHERE email=$1', [email.toLowerCase()]
        );
        // Always return success to prevent enumeration
        if (!userR.rows.length || userR.rows[0].email_verified)
            return res.json({ success: true, message: 'If that email exists and is unverified, a new link has been sent.' });

        const vToken     = crypto.randomBytes(32).toString('hex');
        const vExpiresAt = new Date(Date.now() + 86_400_000);

        // Delete any existing token for this email then insert fresh
        await db.query('DELETE FROM email_verifications WHERE email=$1', [email.toLowerCase()]);
        await db.query(
            'INSERT INTO email_verifications (email, token, expires_at) VALUES ($1,$2,$3)',
            [email.toLowerCase(), vToken, vExpiresAt]
        );

        const verifyLink = `${req.protocol}://${req.get('host')}/verify-email?token=${vToken}`;
        try {
            await sendVerificationEmail(email.toLowerCase(), verifyLink, userR.rows[0].username);
        } catch (mailErr) {
            console.error('[auth] resend verification email error:', mailErr.message);
        }

        return res.json({ success: true, message: 'Verification email sent! Check your inbox.' });
    } catch (err) {
        console.error('[auth] resend-verification error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = { register, login, googleAuth, logout, forgotPassword, resetPassword, resendVerification };
