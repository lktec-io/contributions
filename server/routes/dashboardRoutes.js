const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { denyCustomSms } = require('../middleware/smsMode');
const { getAdminStats, getClientStats } = require('../controllers/dashboardController');

router.get('/admin',  auth, requireRole('super_admin', 'admin'), getAdminStats);
// Client stats are financial totals — not available to a Custom SMS account
router.get('/client', auth, requireRole('client_user'), denyCustomSms, getClientStats);

module.exports = router;
