const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { denyCustomSms } = require('../middleware/smsMode');
const { create, getByContribution } = require('../controllers/paymentController');

router.use(auth, denyCustomSms);

router.post('/', create);
router.get('/:contributionId', getByContribution);

module.exports = router;
