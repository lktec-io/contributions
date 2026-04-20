const bcrypt = require('bcrypt');
const User = require('../models/User');
const { canAccessUser } = require('../utils/tenantHelpers');

async function getAll(req, res, next) {
  try {
    const filter = req.user.role === 'super_admin'
      ? {}                                      // super_admin sees ALL users
      : { createdBy: req.user.userId };         // admin sees only their own
    const users = await User.findAll(filter);
    return res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errors: [] });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

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

    // Only super_admin may create admin accounts
    if (role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admin can create admin accounts', errors: [] });
    }
    // Nobody may create another super_admin via this endpoint
    if (role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Cannot create super admin accounts', errors: [] });
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
      role:       role || 'client_user',
      created_by: req.user.userId,
    });

    const newUser = await User.findById(id);
    return res.status(201).json({ success: true, data: newUser });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errors: [] });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const { name, email, password, role } = req.body;
    const fields = {};
    if (name)     fields.name     = name;
    if (email)    fields.email    = email;
    if (role)     fields.role     = role;
    if (password) fields.password = await bcrypt.hash(password, 10);

    await User.update(req.params.id, fields);
    const updated = await User.findById(req.params.id);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errors: [] });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await User.delete(req.params.id);
    return res.json({ success: true, data: { message: 'User deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errors: [] });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    const result = await User.toggleStatus(req.params.id);
    return res.json({ success: true, data: { message: 'Status updated', is_active: result.is_active } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove, toggleStatus };
