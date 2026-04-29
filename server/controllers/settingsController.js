'use strict';

const bcrypt  = require('bcrypt');
const pool    = require('../config/db');
const Setting = require('../models/Setting');
const User    = require('../models/User');

const ALLOWED_KEYS = {
  super_admin: ['system_name', 'system_logo', 'default_currency', 'sms_provider', 'enable_notifications'],
  admin:       ['organization_name', 'enable_notifications', 'enable_sms'],
  client_user: ['notification_preference'],
};

async function getSettings(req, res, next) {
  try {
    const { role, userId } = req.user;

    const global   = await Setting.getAll(0);
    const personal = role === 'super_admin' ? {} : await Setting.getAll(userId);
    const merged   = { ...global, ...personal };

    const userRecord = await User.findById(userId);
    if (userRecord) {
      merged.profile_name  = userRecord.name;
      merged.profile_email = userRecord.email;
    }

    return res.json({ success: true, data: merged });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { role, userId } = req.user;
    const { settings: incoming } = req.body;

    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload' });
    }

    const allowed  = ALLOWED_KEYS[role] || [];
    const scoped   = Object.fromEntries(
      Object.entries(incoming).filter(([k]) => allowed.includes(k))
    );
    const targetId = role === 'super_admin' ? 0 : userId;

    if (Object.keys(scoped).length) {
      await Setting.upsertMany(targetId, scoped);
    }

    const profileUpdate = {};
    if (incoming.profile_name?.trim())  profileUpdate.name  = incoming.profile_name.trim();
    if (incoming.profile_email?.trim()) profileUpdate.email = incoming.profile_email.trim().toLowerCase();
    if (Object.keys(profileUpdate).length) {
      await User.update(userId, profileUpdate);
    }

    return res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    next(err);
  }
}

async function updatePassword(req, res, next) {
  try {
    const { userId } = req.user;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    await User.update(userId, { password: hashed });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettings, updatePassword };
