'use strict';

const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// Memory storage — the file buffer is streamed straight to Cloudinary and
// never written to local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, JPEG, or WEBP images are allowed'));
    }
    cb(null, true);
  },
});

const uploadSingle = upload.single('logo');

// Wraps multer so file-type/size rejections come back as a clean 400 JSON
// response through the existing global error handler, instead of a bare
// 500 (multer's own errors don't set statusCode).
module.exports = function uploadLogo(req, res, next) {
  uploadSingle(req, res, (err) => {
    if (err) {
      err.statusCode = 400;
      return next(err);
    }
    next();
  });
};

