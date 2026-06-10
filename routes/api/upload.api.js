// routes/api/upload.api.js — /api/upload/*
'use strict';

const { Router }                            = require('express');
const { isAuthenticated, isAdmin,
        isInstructor }                      = require('../../middleware/auth');

const router = Router();

let upload, uploadMedia, uploadToCloudinary, uploadMediaToCloudinary, deleteFromCloudinary;

try {
    const cld = require('../../config/cloudinary');
    upload                    = cld.upload;
    uploadMedia               = cld.uploadMedia;
    uploadToCloudinary        = cld.uploadToCloudinary;
    uploadMediaToCloudinary   = cld.uploadMediaToCloudinary;
    deleteFromCloudinary      = cld.deleteFromCloudinary;
} catch (e) {
    console.warn('[upload.api] config/cloudinary.js unavailable — upload routes disabled:', e.message);
}

function requireCloudinary(req, res, next) {
    if (!upload || !uploadToCloudinary)
        return res.status(503).json({ success: false, message: 'Upload service not configured.' });
    next();
}

// ── Generic image upload factory ──────────────────────────────────────────────
function handleImageUpload(folder, transformation) {
    return [
        requireCloudinary,
        (req, res, next) => upload.single('image')(req, res, next),
        async (req, res) => {
            try {
                if (!req.file)
                    return res.status(400).json({ success: false, message: 'No image file provided.' });
                const result = await uploadToCloudinary(req.file.buffer, folder, { transformation });
                return res.json({
                    success:  true,
                    imageUrl: result.secure_url,
                    publicId: result.public_id,
                    width:    result.width,
                    height:   result.height,
                });
            } catch (err) {
                console.error(`[upload] ${folder} error:`, err);
                return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
            }
        },
    ];
}

// ── Course image — instructors + admins ───────────────────────────────────────
router.post('/course-image',
    isAuthenticated, isInstructor,
    ...handleImageUpload('courses', [{ width: 800, height: 500, crop: 'fill' }])
);

// ── Team / project / blog images — admin only ─────────────────────────────────
router.post('/team-image',
    isAuthenticated, isAdmin,
    ...handleImageUpload('team',     [{ width: 400, height: 400, crop: 'fill' }])
);
router.post('/project-image',
    isAuthenticated, isAdmin,
    ...handleImageUpload('projects', [{ width: 800, height: 600, crop: 'limit' }])
);
router.post('/blog-image',
    isAuthenticated, isAdmin,
    ...handleImageUpload('blog',     [{ width: 1200, height: 630, crop: 'fill' }])
);

// ── Lesson video — instructors + admins ───────────────────────────────────────
router.post('/lesson-video',
    isAuthenticated, isInstructor,
    requireCloudinary,
    (req, res, next) => uploadMedia.single('video')(req, res, next),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No video file provided.' });
            const result = await uploadMediaToCloudinary(
                req.file.buffer,
                'lessons/videos',
                { resourceType: 'video' }
            );
            return res.json({
                success:   true,
                videoUrl:  result.secure_url,
                publicId:  result.public_id,
                duration:  result.duration ? Math.round(result.duration) : null,
                format:    result.format,
            });
        } catch (err) {
            console.error('[upload] lesson-video error:', err);
            return res.status(500).json({ success: false, message: err.message || 'Video upload failed.' });
        }
    }
);

// ── Lesson attachment (PDF) — instructors + admins ────────────────────────────
router.post('/lesson-attachment',
    isAuthenticated, isInstructor,
    requireCloudinary,
    (req, res, next) => uploadMedia.single('attachment')(req, res, next),
    async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No attachment file provided.' });
            const result = await uploadMediaToCloudinary(
                req.file.buffer,
                'lessons/attachments',
                { resourceType: 'raw' }
            );
            return res.json({
                success:        true,
                attachmentUrl:  result.secure_url,
                publicId:       result.public_id,
                originalName:   req.file.originalname,
                bytes:          result.bytes,
            });
        } catch (err) {
            console.error('[upload] lesson-attachment error:', err);
            return res.status(500).json({ success: false, message: err.message || 'Attachment upload failed.' });
        }
    }
);

// ── Certificate image — admin only ────────────────────────────────────────────
router.post('/certificate',
    isAuthenticated, isAdmin,
    ...handleImageUpload('certificates', [{ width: 1600, height: 1131, crop: 'fill' }])
);

// ── Delete — admin only ───────────────────────────────────────────────────────
router.delete('/delete',
    isAuthenticated, isAdmin,
    requireCloudinary,
    async (req, res) => {
        try {
            const { publicId, resourceType = 'image' } = req.body;
            if (!publicId)
                return res.status(400).json({ success: false, message: 'publicId required.' });
            const ok = await deleteFromCloudinary(publicId, resourceType);
            if (ok) return res.json({ success: true, message: 'Deleted from Cloudinary.' });
            return res.status(500).json({ success: false, message: 'Delete failed.' });
        } catch (err) {
            console.error('[upload] delete error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }
);

module.exports = router;
