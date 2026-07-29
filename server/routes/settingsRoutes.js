const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const uploadLogo = require('../middleware/uploadLogo');
const { getSettings, updateSettings, updatePassword, uploadBrandingLogo, removeBrandingLogo } = require('../controllers/settingsController');

router.use(auth);

router.get('/',          getSettings);
router.post('/',         updateSettings);
router.post('/password', updatePassword);

router.post('/branding/logo',   uploadLogo, uploadBrandingLogo);
router.delete('/branding/logo', removeBrandingLogo);

module.exports = router;
