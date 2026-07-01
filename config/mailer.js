// config/mailer.js — nodemailer transporter + email helpers
'use strict';

const nodemailer = require('nodemailer');

function createTransporter() {
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    if (!user || !pass) return null;
    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST || 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth:   { user, pass },
    });
}

async function sendResetEmail(toEmail, resetLink) {
    const transporter = createTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
        from:    process.env.SMTP_FROM || `"NeurowexTech" <${process.env.SMTP_USER}>`,
        to:      toEmail,
        subject: 'Reset your NeurowexTech password',
        text:    `Hi,\n\nYou requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.\n\n— NeurowexTech`,
        html:    `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:36px 40px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-.3px">NeurowexTech</h1>
    <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px">Password Reset Request</p>
  </td></tr>
  <tr><td style="padding:40px">
    <p style="color:#334155;font-size:15px;margin:0 0 20px">Hi,</p>
    <p style="color:#334155;font-size:15px;margin:0 0 28px;line-height:1.7">We received a request to reset your password. Click the button below to create a new password. This link is valid for <strong>1 hour</strong>.</p>
    <div style="text-align:center;margin:0 0 32px">
      <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:.2px">Reset My Password</a>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0 0 6px">Or copy and paste this link into your browser:</p>
    <p style="color:#2563eb;font-size:12px;word-break:break-all;margin:0 0 28px">${resetLink}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center">
    <p style="color:#94a3b8;font-size:11px;margin:0">© ${new Date().getFullYear()} NeurowexTech · Nairobi, Kenya</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    });
    return true;
}

async function sendVerificationEmail(toEmail, verifyLink, username) {
    const transporter = createTransporter();
    if (!transporter) return false;

    const name = username || 'there';
    await transporter.sendMail({
        from:    process.env.SMTP_FROM || `"NeurowexTech" <${process.env.SMTP_USER}>`,
        to:      toEmail,
        subject: 'Verify your NeurowexTech email address',
        text:    `Hi ${name},\n\nThank you for creating a NeurowexTech account!\n\nClick the link below to verify your email address:\n\n${verifyLink}\n\nThis link expires in 24 hours.\n\nIf you did not create this account, ignore this email.\n\n— NeurowexTech`,
        html:    `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:36px 40px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-.3px">NeurowexTech</h1>
    <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px">Confirm your email address</p>
  </td></tr>
  <tr><td style="padding:40px">
    <p style="color:#334155;font-size:15px;margin:0 0 12px">Hi <strong>${name}</strong>,</p>
    <p style="color:#334155;font-size:15px;margin:0 0 28px;line-height:1.7">Welcome to NeurowexTech! Click the button below to verify your email address and activate your account. This link is valid for <strong>24 hours</strong>.</p>
    <div style="text-align:center;margin:0 0 32px">
      <a href="${verifyLink}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:.2px">Verify My Email</a>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0 0 6px">Or copy and paste this link into your browser:</p>
    <p style="color:#059669;font-size:12px;word-break:break-all;margin:0 0 28px">${verifyLink}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6">If you didn't create a NeurowexTech account, you can safely ignore this email.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center">
    <p style="color:#94a3b8;font-size:11px;margin:0">© ${new Date().getFullYear()} NeurowexTech · Nairobi, Kenya</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    });
    return true;
}

module.exports = { sendResetEmail, sendVerificationEmail };
