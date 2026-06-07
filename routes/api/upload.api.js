// routes/api/upload.api.js — /api/upload/*
// Loads Cloudinary config from the project root config/cloudinary.js.
// If that file doesn't exist or doesn't export the expected helpers,
// the upload routes are skipped gracefully (no crash on startup).
'use strict';

const { Router }                   = require('express');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');

const router = Router();
router.use(isAuthenticated, isAdmin);

let upload, uploadToCloudinary, deleteFromCloudinary;

try {
    const cloudinary = require('../../config/cloudinary');
    upload               = cloudinary.upload;
    uploadToCloudinary   = cloudinary.uploadToCloudinary;
    deleteFromCloudinary = cloudinary.deleteFromCloudinary;
} catch (e) {
    console.warn('[upload.api] config/cloudinary.js not found or missing exports — upload routes disabled:', e.message);
}

// Guard: if cloudinary isn't configured, return 503 on all upload routes
function requireCloudinary(req, res, next) {
    if (!upload || !uploadToCloudinary) {
        return res.status(503).json({ success: false, message: 'Image upload service not configured.' });
    }
    next();
}

function handleUpload(folder, transformation) {
    return [
        requireCloudinary,
        function multerMiddleware(req, res, next) {
            upload.single('image')(req, res, next);
        },
        async (req, res) => {
            try {
                if (!req.file)
                    return res.status(400).json({ success: false, message: 'No image file provided' });
                const result = await uploadToCloudinary(req.file.buffer, folder, { transformation });
                return res.json({
                    success:   true,
                    imageUrl:  result.secure_url,
                    publicId:  result.public_id,
                    width:     result.width,
                    height:    result.height,
                });
            } catch (err) {
                console.error(`[upload] ${folder} error:`, err);
                return res.status(500).json({ success: false, message: err.message || 'Upload failed' });
            }
        },
    ];
}

router.post('/course-image',  ...handleUpload('courses', [{ width: 800, height: 500, crop: 'fill' }]));
router.post('/team-image',    ...handleUpload('team',    [{ width: 400, height: 400, crop: 'fill' }]));
router.post('/project-image', ...handleUpload('projects',[{ width: 800, height: 600, crop: 'limit' }]));
router.post('/blog-image',    ...handleUpload('blog',    [{ width: 1200, height: 630, crop: 'fill' }]));

router.delete('/delete', requireCloudinary, async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId)
            return res.status(400).json({ success: false, message: 'Public ID required' });
        const result = await deleteFromCloudinary(publicId);
        if (result) return res.json({ success: true, message: 'Image deleted successfully' });
        return res.status(500).json({ success: false, message: 'Failed to delete image' });
    } catch (err) {
        console.error('[upload] delete error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
