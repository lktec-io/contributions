const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { getAll, getById, create, update, remove, toggleStatus } = require('../controllers/userController');

// Both super_admin and admin can manage users (scoped by their own data)
router.use(auth, requireRole('super_admin', 'admin'));

router.get('/',                   getAll);
router.post('/',                  create);
router.get('/:id',                getById);
router.put('/:id',                update);
router.delete('/:id',             remove);
router.put('/:id/toggle-status',  toggleStatus);

module.exports = router;
