const express = require('express');
const router = express.Router();
const { getContribution, submitPaymentRequest, downloadReceipt } = require('../controllers/publicController');

router.get('/contributions/:token', getContribution);
router.post('/contributions/:token/payment-request', submitPaymentRequest);
router.get('/contributions/:token/receipt', downloadReceipt);

module.exports = router;
