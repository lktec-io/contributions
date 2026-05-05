const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendReminder, sendBulkReminders, getBulkStatus } = require('../controllers/smsController');

// Check if user can send bulk SMS (weekly limit)
router.get('/bulk-status', auth, getBulkStatus);

// Send reminder to a single contributor
router.post('/reminder/:id', auth, sendReminder);

// Send bulk reminders for an event (or all)
router.post('/bulk-reminder', auth, sendBulkReminders);

module.exports = router;
