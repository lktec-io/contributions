const bcrypt = require('bcrypt');
const User = require('../models/User');

/**
 * POST /api/admin/create
 * Only super_admin can call this.
 * Creates a new admin account owned by the calling super_admin.
 */
async function createAdmin(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [
          !name     && { field: 'name',     message: 'name is required' },
          !email    && { field: 'email',    message: 'email is required' },
          !password && { field: 'password', message: 'password is required' },
        ].filter(Boolean),
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
        errors: [{ field: 'password', message: 'Password must be at least 8 characters' }],
      });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use', errors: [] });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = await User.create({
      name,
      email,
      password:   hashedPassword,
      role:       'admin',
      created_by: req.user.userId,
    });

    const newAdmin = await User.findById(id);
    return res.status(201).json({ success: true, data: newAdmin });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/list
 * Returns all admin accounts created by this super_admin.
 */
async function listAdmins(req, res, next) {
  try {
    const admins = await User.findAll({ role: 'admin', createdBy: req.user.userId });
    return res.json({ success: true, data: admins });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/:id
 * super_admin can delete an admin they created.
 */
async function deleteAdmin(req, res, next) {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found', errors: [] });
    }
    if (admin.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Target is not an admin account', errors: [] });
    }
    if (admin.created_by !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await User.delete(req.params.id);
    return res.json({ success: true, data: { message: 'Admin deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/:id/toggle-status
 */
async function toggleAdminStatus(req, res, next) {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found', errors: [] });
    }
    if (admin.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Target is not an admin account', errors: [] });
    }
    if (admin.created_by !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    const result = await User.toggleStatus(req.params.id);
    return res.json({ success: true, data: { message: 'Status updated', is_active: result.is_active } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createAdmin, listAdmins, deleteAdmin, toggleAdminStatus };
