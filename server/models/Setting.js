'use strict';

const pool = require('../config/db');

/*
  Scope semantics
  ───────────────────────────────────────────────────
  Global   (super_admin) : user_id = 0,  organization_id = 0
  Org      (admin)       : user_id = 0,  organization_id = admin's user_id
  Personal (client_user) : user_id = N,  organization_id = 0
*/

const Setting = {

  // ── Read helpers ──────────────────────────────────────────────

  async getGlobal() {
    const [rows] = await pool.query(
      'SELECT `key`, value FROM settings WHERE user_id = 0 AND organization_id = 0'
    );
    return toMap(rows);
  },

  async getOrg(orgId) {
    const [rows] = await pool.query(
      'SELECT `key`, value FROM settings WHERE user_id = 0 AND organization_id = ?',
      [orgId]
    );
    return toMap(rows);
  },

  async getPersonal(userId) {
    const [rows] = await pool.query(
      'SELECT `key`, value FROM settings WHERE user_id = ? AND organization_id = 0',
      [userId]
    );
    return toMap(rows);
  },

  // ── getPaymentMethods ────────────────────────────────────────
  // Public Contribution Portal: resolves the 3 payment-method strings for a
  // contribution's owning event. client_user-owned values (personal scope,
  // keyed by contribution.organization_id) take precedence over the managing
  // admin's org-wide defaults (org scope, keyed by contribution.event_created_by).
  // Only the 3 named keys are ever returned — never the full settings map.
  async getPaymentMethods(contribution) {
    const KEYS = ['payment_mpesa', 'payment_mixx', 'payment_bank'];
    const [personal, org] = await Promise.all([
      Setting.getPersonal(contribution.organization_id),
      Setting.getOrg(contribution.event_created_by),
    ]);
    const merged = { ...org, ...personal };
    const result = {};
    for (const key of KEYS) {
      if (merged[key]) result[key] = merged[key];
    }
    return result;
  },

  // ── Write helpers ─────────────────────────────────────────────

  async upsert(userId, orgId, key, value) {
    await pool.query(
      `INSERT INTO settings (user_id, organization_id, \`key\`, value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [userId, orgId, key, String(value ?? '')]
    );
  },

  async upsertMany(userId, orgId, data) {
    for (const [key, value] of Object.entries(data)) {
      await Setting.upsert(userId, orgId, key, value);
    }
  },
};

// ── Private ───────────────────────────────────────────────────────
function toMap(rows) {
  return rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
}

module.exports = Setting;
