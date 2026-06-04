// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Configure multer for memory storage (we'll upload to Cloudinary directly)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif, svg)'));
        }
    }
});

// Upload image to Cloudinary
const uploadToCloudinary = async (fileBuffer, folder, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `neurowextech/${folder}`,
                transformation: options.transformation || [{ width: 1200, height: 800, crop: 'limit' }],
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif']
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(fileBuffer);
    });
};

// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return false;
        const result = await cloudinary.uploader.destroy(publicId);
        return result.result === 'ok';
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return false;
    }
};

// Get public ID from Cloudinary URL
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts.pop();
    const folder = parts.slice(parts.indexOf('neurowextech')).join('/');
    return `${folder}/${filename.split('.')[0]}`;
};

module.exports = {
    cloudinary,
    upload,
    uploadToCloudinary,
    deleteFromCloudinary,
    getPublicIdFromUrl
};

// DEBUG: Check the file size limit
console.log('Upload file size limit:', upload.limits.fileSize / (1024 * 1024), 'MB');