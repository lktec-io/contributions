const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { getAdminStats, getClientStats } = require('../controllers/dashboardController');

router.get('/admin',  auth, requireRole('super_admin', 'admin'), getAdminStats);
router.get('/client', auth, requireRole('client_user'),          getClientStats);

module.exports = router;
