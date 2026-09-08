'use strict';

const pool = require('../config/db');

/**
 * Resolves an account's assigned SMS mode.
 * Falls back to 'dispatch_all' — the capability every account had before the
 * sms_mode column existed — so a pending migration can never silently revoke
 * access from an existing user.
 * @param {number} userId
 * @returns {Promise<'custom'|'dispatch_all'>}
 */
async function getSmsMode(userId) {
  try {
    const [rows] = await pool.query('SELECT sms_mode FROM users WHERE id = ? LIMIT 1', [userId]);
    return rows[0] && rows[0].sms_mode === 'custom' ? 'custom' : 'dispatch_all';
  } catch {
    return 'dispatch_all';
  }
}

/**
 * Blocks Custom SMS accounts from contribution / payment surfaces.
 * A Custom SMS account is a communication-only workspace, so hiding those
 * screens in the UI is not enough — the API must reject them too.
 *
 * super_admin is always exempt. Every other account is unaffected unless it has
 * explicitly been assigned sms_mode = 'custom'.
 */
async function denyCustomSms(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errors: [] });
    }
    if (req.user.role === 'super_admin') return next();

    const mode = await getSmsMode(req.user.userId);
    if (mode === 'custom') {
      return res.status(403).json({
        success: false,
        message: 'Your account does not have access to this feature.',
        errors:  [],
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { getSmsMode, denyCustomSms };
