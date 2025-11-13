// middlewares/upload.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// 1️⃣ Storage for normal uploads
const uploadStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
});
const upload = multer({ storage: uploadStorage });

// 2️⃣ Storage for converted uploads
const convertedStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'converted',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
});
const uploadConverted = multer({ storage: convertedStorage });

// Export both
module.exports = { upload, uploadConverted };
