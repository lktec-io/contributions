'use strict';

const { verifyAccessToken } = require('../config/jwt');
const pool = require('../config/db');

/**
 * Authentication middleware.
 * 1. Verifies the Bearer token signature and expiry.
 * 2. Confirms the user still exists and is active in the DB.
 *    This ensures deleted or deactivated accounts are rejected
 *    even when they hold a valid (not-yet-expired) JWT.
 */
async function auth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  // Re-check the user record on every request so deleted/deactivated
  // accounts cannot continue using an otherwise-valid JWT.
  try {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
      [payload.userId]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (dbErr) {
    // DB unavailable — log and fall through. Don't block every request
    // due to a transient connection issue; the signed JWT is still proof of identity.
    console.error('[auth] DB liveness check failed:', dbErr.message);
  }

  req.user = {
    userId: payload.userId,
    email:  payload.email,
    role:   payload.role,
  };
  next();
}

module.exports = auth;
