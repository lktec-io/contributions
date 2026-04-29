'use strict';

const pool = require('../config/db');

// user_id = 0  →  global / super_admin scope
// user_id = N  →  personal scope for that user

const Setting = {
  async getAll(userId) {
    const [rows] = await pool.query(
      'SELECT `key`, value FROM settings WHERE user_id = ?',
      [userId]
    );
    return rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
  },

  async upsert(userId, key, value) {
    await pool.query(
      `INSERT INTO settings (user_id, \`key\`, value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [userId, key, String(value ?? '')]
    );
  },

  async upsertMany(userId, data) {
    for (const [key, value] of Object.entries(data)) {
      await Setting.upsert(userId, key, value);
    }
  },
};

module.exports = Setting;
