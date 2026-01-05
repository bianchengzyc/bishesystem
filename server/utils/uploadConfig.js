const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Ensure upload directory exists
const fs = require('fs');
const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${fileExt}`);
  }
});

// File filter configuration
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES ? 
    process.env.ALLOWED_FILE_TYPES.split(',') : 
    ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG/JPEG, PNG, and TIF/TIFF files are allowed.'), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE ? 
      parseSize(process.env.MAX_FILE_SIZE) : 
      200 * 1024 * 1024 // 200MB default
  },
  fileFilter: fileFilter
});

// Helper function to parse size string to bytes
function parseSize(size) {
  const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  const match = size.match(/^(\d+)([KMGT]B?)$/i);
  if (!match) return size;
  return parseInt(match[1]) * units[match[2].toUpperCase()];
}

module.exports = upload;