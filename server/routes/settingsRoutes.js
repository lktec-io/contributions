const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getSettings, updateSettings, updatePassword } = require('../controllers/settingsController');

router.use(auth);

router.get('/',          getSettings);
router.post('/',         updateSettings);
router.post('/password', updatePassword);

module.exports = router;
