const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  sendReminder, sendBulkReminders, getBulkStatus, sendMemberSms,
  sendCustomCampaign, previewCustomCampaign,
} = require('../controllers/smsController');

// Check if user can send bulk SMS (weekly limit)
router.get('/bulk-status', auth, getBulkStatus);

// Send reminder to a single contributor
router.post('/reminder/:id', auth, sendReminder);

// Send bulk reminders for an event (or all)
router.post('/bulk-reminder', auth, sendBulkReminders);

// Send an individual Custom SMS to one member (per-member cooldown)
router.post('/member/:id', auth, sendMemberSms);

// Eligible/skipped counts + rendered sample, before confirming the campaign
router.post('/members/campaign/preview', auth, previewCustomCampaign);

// Send Custom SMS to all owned members (campaign-level cooldown)
router.post('/members/campaign', auth, sendCustomCampaign);

module.exports = router;
