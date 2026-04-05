const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { exportCSV, exportXLSX, exportPDF } = require('../controllers/exportController');

router.use(auth);

router.get('/csv', exportCSV);
router.get('/xlsx', exportXLSX);
router.get('/pdf', exportPDF);

module.exports = router;
