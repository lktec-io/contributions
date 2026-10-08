const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { list, summary, detail, analytics } = require('../controllers/smsHistoryController');

// Read-only SMS history. Every route is behind the existing auth middleware
// and scoped to the caller inside the controller's SQL.

// Summary counts for the current scope and filters
router.get('/summary', auth, summary);

// Pre-aggregated trend / type / status data for the dashboard charts
router.get('/analytics', auth, analytics);

// Paginated, searchable, filterable log list
router.get('/', auth, list);

// One full record, including the complete body and provider error
router.get('/:id', auth, detail);

module.exports = router;
