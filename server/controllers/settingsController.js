'use strict';

const bcrypt  = require('bcrypt');
const pool    = require('../config/db');
const Setting = require('../models/Setting');
const User    = require('../models/User');
const { cloudinary, isConfigured } = require('../config/cloudinary');

/*
  Which keys each role is allowed to save.
  Keys listed in ALWAYS_PERSONAL_KEYS are treated specially — they are
  always written to (and read from) the user's own personal scope
  regardless of role, so branding is one flat per-account value for
  super_admin/admin/client_user alike, with no org/global inheritance.
*/
const ALWAYS_PERSONAL_KEYS = ['notification_preference', 'branding_logo_url', 'branding_org_name'];

const ROLE_KEYS = {
  super_admin: [
    'system_name',
    'system_logo',
    'default_currency',
    'sms_provider',
    'enable_notifications',
    'notification_preference',
    'branding_logo_url',
    'branding_org_name',
  ],
  admin: [
    'organization_name',
    'enable_notifications',
    'enable_sms',
    'sms_provider',
    'notification_preference',
    'payment_methods_mobile',
    'payment_methods_bank',
    'branding_logo_url',
    'branding_org_name',
  ],
  client_user: [
    'notification_preference',
    'payment_methods_mobile',
    'payment_methods_bank',
    'branding_logo_url',
    'branding_org_name',
  ],
};

const MAX_ORG_NAME_LENGTH = 100;

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

    // Always layer these personal-scope values on top for every role —
    // notification_preference already worked this way; branding just
    // reuses the identical pattern instead of introducing new scope logic.
    ALWAYS_PERSONAL_KEYS.forEach((key) => {
      if (personal[key] !== undefined) merged[key] = personal[key];
    });

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

    if ('branding_org_name' in incoming && typeof incoming.branding_org_name === 'string'
      && incoming.branding_org_name.length > MAX_ORG_NAME_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Organization name must be ${MAX_ORG_NAME_LENGTH} characters or fewer`,
        errors: [{ field: 'branding_org_name', message: 'Too long' }],
      });
    }

    // ── Role-scoped settings (everything except the always-personal keys) ──
    const scopeKeys = allowed.filter(k => !ALWAYS_PERSONAL_KEYS.includes(k));
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

    // ── Always-personal-scope keys (notification_preference, branding) ──────
    for (const key of ALWAYS_PERSONAL_KEYS) {
      if (key in incoming && allowed.includes(key)) {
        await Setting.upsert(userId, 0, key, incoming[key]);
      }
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

// ── POST /api/settings/branding/logo ───────────────────────────────
// Uploads to Cloudinary and immediately persists the resulting URL to the
// caller's own personal branding setting — logo changes save on upload,
// unlike the other settings fields which wait for "Save Changes".
async function uploadBrandingLogo(req, res, next) {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Logo upload is not configured yet. Please contact an administrator.',
        errors: [],
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file was provided', errors: [] });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'finance-hub/branding',
      // Forced to PNG deterministically (not fetch_format:'auto') — pdfkit
      // and ExcelJS's image embedding only support PNG/JPEG, not WEBP, so
      // the stored asset must always be one we can actually render into
      // reports/receipts regardless of what format was uploaded.
      format: 'png',
      transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto' }],
    });

    await Setting.upsert(req.user.userId, 0, 'branding_logo_url', result.secure_url);

    return res.json({ success: true, data: { logo_url: result.secure_url } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/settings/branding/logo ──────────────────────────────
async function removeBrandingLogo(req, res, next) {
  try {
    await Setting.upsert(req.user.userId, 0, 'branding_logo_url', '');
    return res.json({ success: true, message: 'Logo removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettings, updatePassword, uploadBrandingLogo, removeBrandingLogo };
