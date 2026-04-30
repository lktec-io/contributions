'use strict';

const bcrypt  = require('bcrypt');
const pool    = require('../config/db');
const Setting = require('../models/Setting');
const User    = require('../models/User');

/*
  Which keys each role is allowed to save.
  `notification_preference` is treated specially — it is always written
  to the user's own personal scope regardless of role.
*/
const ROLE_KEYS = {
  super_admin: [
    'system_name',
    'system_logo',
    'default_currency',
    'sms_provider',
    'enable_notifications',
    'notification_preference',
  ],
  admin: [
    'organization_name',
    'enable_notifications',
    'enable_sms',
    'sms_provider',
    'notification_preference',
  ],
  client_user: [
    'notification_preference',
  ],
};

// ── GET /api/settings ─────────────────────────────────────────────
async function getSettings(req, res, next) {
  try {
    const { role, userId } = req.user;

    // Base: global settings written by super_admin
    const global   = await Setting.getGlobal();
    // Personal settings (notification_preference, etc.) for every role
    const personal = await Setting.getPersonal(userId);

    let merged = { ...global };

    if (role === 'admin') {
      // Org settings are keyed by the admin's own user_id as organization_id
      const org = await Setting.getOrg(userId);
      Object.assign(merged, org);
    } else if (role === 'client_user') {
      Object.assign(merged, personal);
    }

    // Always layer personal notification_preference on top for every role
    if (personal.notification_preference !== undefined) {
      merged.notification_preference = personal.notification_preference;
    }

    // Inject live profile data so the frontend always shows current values
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

// ── POST /api/settings ────────────────────────────────────────────
async function updateSettings(req, res, next) {
  try {
    const { role, userId } = req.user;
    const { settings: incoming } = req.body;

    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload' });
    }

    const allowed = ROLE_KEYS[role] ?? [];

    // ── Role-scoped settings (everything except notification_preference) ──
    const scopeKeys = allowed.filter(k => k !== 'notification_preference');
    const scopeData = Object.fromEntries(
      Object.entries(incoming).filter(([k]) => scopeKeys.includes(k))
    );

    if (Object.keys(scopeData).length) {
      if (role === 'super_admin') {
        // super_admin writes to global scope (user_id=0, org_id=0)
        await Setting.upsertMany(0, 0, scopeData);
      } else if (role === 'admin') {
        // admin writes to their org scope (user_id=0, org_id=admin userId)
        await Setting.upsertMany(0, userId, scopeData);
      } else {
        // client_user writes to personal scope (user_id=userId, org_id=0)
        await Setting.upsertMany(userId, 0, scopeData);
      }
    }

    // ── notification_preference is ALWAYS personal scope ──────────────────
    if (
      'notification_preference' in incoming &&
      allowed.includes('notification_preference')
    ) {
      await Setting.upsert(userId, 0, 'notification_preference', incoming.notification_preference);
    }

    // ── Profile (name / email) ─────────────────────────────────────────────
    const profileUpdate = {};
    if (incoming.profile_name?.trim())  profileUpdate.name  = incoming.profile_name.trim();
    if (incoming.profile_email?.trim()) profileUpdate.email = incoming.profile_email.trim().toLowerCase();
    if (Object.keys(profileUpdate).length) {
      await User.update(userId, profileUpdate);
    }

    return res.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/settings/password ───────────────────────────────────
async function updatePassword(req, res, next) {
  try {
    const { userId } = req.user;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
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
