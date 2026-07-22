const express = require('express');
const router = express.Router();
const { getContribution, submitPaymentRequest } = require('../controllers/publicController');

router.get('/contributions/:token', getContribution);
router.post('/contributions/:token/payment-request', submitPaymentRequest);

module.exports = router;
