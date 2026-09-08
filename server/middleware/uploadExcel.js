'use strict';

const multer = require('multer');

// .xlsx / .xls. Some browsers send octet-stream for .xls, so the extension is
// checked as well as the mime type.
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Memory storage — the workbook is parsed from the buffer and never written
// to local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const okExt  = /\.(xlsx|xls)$/i.test(file.originalname || '');
    const okMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    if (!okExt || !okMime) {
      return cb(new Error('Only .xlsx or .xls files are allowed'));
    }
    cb(null, true);
  },
});

const uploadSingle = upload.single('file');

// Mirrors uploadLogo: turns multer's type/size rejections into a clean 400
// through the existing global error handler instead of a bare 500.
module.exports = function uploadExcel(req, res, next) {
  uploadSingle(req, res, (err) => {
    if (err) {
      err.statusCode = 400;
      return next(err);
    }
    next();
  });
};
