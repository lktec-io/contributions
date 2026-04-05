const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_super_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

/**
 * Signs a JWT access token with the given payload.
 * @param {object} payload
 * @returns {string} signed JWT
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generates a secure random 64-character hex refresh token.
 * @returns {string}
 */
function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifies a JWT access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws if token is invalid or expired
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Returns a Date object representing 7 days from now (refresh token expiry).
 * @returns {Date}
 */
function getRefreshExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  getRefreshExpiry,
};
