const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { createAdmin, listAdmins, deleteAdmin, toggleAdminStatus } = require('../controllers/adminController');

// All admin-management routes require super_admin
router.use(auth, requireRole('super_admin'));

router.post('/',                   createAdmin);
router.get('/',                    listAdmins);
router.delete('/:id',              deleteAdmin);
router.put('/:id/toggle-status',   toggleAdminStatus);

module.exports = router;
