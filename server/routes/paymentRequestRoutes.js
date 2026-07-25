const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { list, approve, reject, remove, downloadReceipt } = require('../controllers/paymentRequestController');

router.use(auth);

router.get('/', list);
router.post('/:id/approve', approve);
router.post('/:id/reject', reject);
router.delete('/:id', remove);
router.get('/:id/receipt', downloadReceipt);

module.exports = router;
