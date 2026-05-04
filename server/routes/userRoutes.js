const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getAll, getHidden, getById, create, update, remove, toggleStatus,
  hideUser, restoreUser, permanentDelete,
} = require('../controllers/userController');

router.use(auth, requireRole('super_admin', 'admin'));

router.get('/hidden',              getHidden);       // must come before /:id
router.get('/',                    getAll);
router.post('/',                   create);
router.get('/:id',                 getById);
router.put('/:id',                 update);
router.delete('/:id',              remove);
router.put('/:id/toggle-status',   toggleStatus);
router.post('/:id/hide',           hideUser);
router.post('/:id/restore',        restoreUser);
router.delete('/:id/permanent',    permanentDelete);

module.exports = router;
