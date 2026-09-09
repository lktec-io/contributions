const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { list, create, update, remove } = require('../controllers/smsTemplateController');

router.use(auth);

// Saved Custom SMS messages — scoped to the authenticated user
router.get('/',       list);
router.post('/',      create);
router.put('/:id',    update);
router.delete('/:id', remove);

module.exports = router;
