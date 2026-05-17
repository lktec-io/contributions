const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { search, getAll } = require('../controllers/contributorController');

router.use(auth);

router.get('/search', search);
router.get('/',       getAll);

module.exports = router;
