const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { search, getAll, getById } = require('../controllers/contributorController');

router.use(auth);

router.get('/search', search);  // must be before /:id
router.get('/',       getAll);
router.get('/:id',    getById);

module.exports = router;
