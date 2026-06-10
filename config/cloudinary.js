// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
const path       = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
});

// ── Image-only multer (existing, for course/blog/team images) ─────────────────
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (_req, file, cb) => {
        const ok = /jpeg|jpg|png|webp|gif|svg/.test(
            path.extname(file.originalname).toLowerCase()
        );
        if (ok) return cb(null, true);
        cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif, svg)'));
    },
});

// ── Media multer (images + video + PDF) ───────────────────────────────────────
const uploadMedia = multer({
    storage,
    limits: { fileSize: 512 * 1024 * 1024 }, // 512 MB (covers HD video)
    fileFilter: (_req, file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;
        const okImage = /jpeg|jpg|png|webp|gif|svg/.test(ext);
        const okVideo = /mp4|webm|mov|avi|mkv/.test(ext) || mime.startsWith('video/');
        const okPdf   = ext === '.pdf' || mime === 'application/pdf';
        if (okImage || okVideo || okPdf) return cb(null, true);
        cb(new Error('Unsupported file type. Allowed: images, mp4/webm/mov video, PDF'));
    },
});

// ── Upload image to Cloudinary ────────────────────────────────────────────────
const uploadToCloudinary = async (fileBuffer, folder, options = {}) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder:           `neurowextech/${folder}`,
                transformation:   options.transformation || [{ width: 1200, height: 800, crop: 'limit' }],
                allowed_formats:  ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'],
            },
            (err, result) => { if (err) reject(err); else resolve(result); }
        );
        stream.end(fileBuffer);
    });
};

// ── Upload video or PDF to Cloudinary ─────────────────────────────────────────
const uploadMediaToCloudinary = async (fileBuffer, folder, options = {}) => {
    const resourceType = options.resourceType || 'auto'; // 'video' | 'raw' | 'auto'
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder:        `neurowextech/${folder}`,
                resource_type: resourceType,
                ...(options.extra || {}),
            },
            (err, result) => { if (err) reject(err); else resolve(result); }
        );
        stream.end(fileBuffer);
    });
};

// ── Delete from Cloudinary ────────────────────────────────────────────────────
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        if (!publicId) return false;
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        return result.result === 'ok';
    } catch (err) {
        console.error('Cloudinary delete error:', err);
        return false;
    }
};

// ── Extract public_id from URL ────────────────────────────────────────────────
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    const parts    = url.split('/');
    const filename = parts.pop();
    const folder   = parts.slice(parts.indexOf('neurowextech')).join('/');
    return `${folder}/${filename.split('.')[0]}`;
};

module.exports = {
    cloudinary,
    upload,
    uploadMedia,
    uploadToCloudinary,
    uploadMediaToCloudinary,
    deleteFromCloudinary,
    getPublicIdFromUrl,
};
