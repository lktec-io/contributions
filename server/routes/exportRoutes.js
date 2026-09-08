const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { denyCustomSms } = require('../middleware/smsMode');
const { exportCSV, exportXLSX, exportPDF } = require('../controllers/exportController');

router.use(auth, denyCustomSms);

router.get('/csv', exportCSV);
router.get('/xlsx', exportXLSX);
router.get('/pdf', exportPDF);

module.exports = router;
