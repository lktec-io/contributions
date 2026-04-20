const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { getAll, getById, create, update, remove } = require('../controllers/eventController');

router.get('/',      auth, getAll);
router.post('/',     auth, requireRole('super_admin', 'admin'), create);
router.get('/:id',   auth, getById);
router.put('/:id',   auth, requireRole('super_admin', 'admin'), update);
router.delete('/:id', auth, requireRole('super_admin', 'admin'), remove);

module.exports = router;
