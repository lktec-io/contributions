const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { list, approve, reject } = require('../controllers/paymentRequestController');

router.use(auth);

router.get('/', list);
router.post('/:id/approve', approve);
router.post('/:id/reject', reject);

module.exports = router;
