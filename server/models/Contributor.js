'use strict';

const pool = require('../config/db');

const ERR_TABLE_NOT_EXISTS = 1146;

const Contributor = {

  // ── findOrCreate ─────────────────────────────────────────────
  // Deduplicates by phone OR email. Returns the contributor id.
  // Returns null if the contributors table doesn't exist yet.
  async findOrCreate({ name, phone, email, created_by }) {
    try {
      const conditions = [];
      const params     = [];
      if (phone) { conditions.push('phone = ?'); params.push(phone); }
      if (email) { conditions.push('email = ?'); params.push(email); }

      if (conditions.length > 0) {
        const [existing] = await pool.query(
          `SELECT id FROM contributors WHERE ${conditions.join(' OR ')} LIMIT 1`,
          params
        );
        if (existing.length > 0) return existing[0].id;
      }

      const [result] = await pool.query(
        `INSERT INTO contributors (name, phone, email, created_by) VALUES (?, ?, ?, ?)`,
        [name, phone || null, email || null, created_by || null]
      );
      return result.insertId;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return null;
      throw err;
    }
  },

  // ── search ───────────────────────────────────────────────────
  // Autocomplete: search by name, phone, or email.
  // Scoped to events accessible to the calling user.
  async search(q, { organizationId, createdBy } = {}) {
    try {
      let query = `
        SELECT DISTINCT co.id, co.name, co.phone, co.email
        FROM contributors co
        JOIN contributions c  ON c.contributor_id = co.id
        JOIN events e         ON e.id = c.event_id
        WHERE (co.name LIKE ? OR co.phone LIKE ? OR co.email LIKE ?)
      `;
      const params = [`%${q}%`, `%${q}%`, `%${q}%`];

      if (createdBy !== null && createdBy !== undefined) {
        query += ' AND e.created_by = ?';
        params.push(createdBy);
      } else if (organizationId !== null && organizationId !== undefined) {
        query += ' AND e.organization_id = ?';
        params.push(organizationId);
      }

      query += ' ORDER BY co.name ASC LIMIT 10';

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return [];
      throw err;
    }
  },

  // ── findAll ──────────────────────────────────────────────────
  // List all global contributors with their event count and totals.
  // Scoped to events accessible to the calling user.
  async findAll({ organizationId, createdBy } = {}) {
    try {
      const joinConditions = ['c.contributor_id = co.id'];
      const params = [];

      if (createdBy !== null && createdBy !== undefined) {
        joinConditions.push('e.created_by = ?');
        params.push(createdBy);
      } else if (organizationId !== null && organizationId !== undefined) {
        joinConditions.push('e.organization_id = ?');
        params.push(organizationId);
      }

      const query = `
        SELECT co.id, co.name, co.phone, co.email, co.created_at,
               COUNT(DISTINCT c.event_id)       AS event_count,
               COALESCE(SUM(c.amount), 0)       AS total_pledged,
               COALESCE(SUM(c.paid_amount), 0)  AS total_paid
        FROM contributors co
        LEFT JOIN contributions c ON ${joinConditions.join(' AND ')}
        LEFT JOIN events e        ON e.id = c.event_id
        GROUP BY co.id
        ORDER BY co.name ASC
      `;

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return [];
      throw err;
    }
  },

  // ── Custom SMS members ───────────────────────────────────────
  // A "member" is a contributors row owned directly by a Custom SMS user
  // (created_by = that user). No contributions join, so members exist purely
  // as name + phone recipients and carry no financial data whatsoever.

  // Lists the caller's own members with each member's own last-sent time,
  // which is what drives the per-member cooldown.
  async findMembers(userId) {
    const withHistory = `
      SELECT co.id, co.name, co.phone, co.created_at,
             (SELECT MAX(l.sent_at) FROM sms_logs l
               WHERE l.recipient_id = co.id AND l.user_id = ?
                 AND l.type = 'custom_member') AS last_sms_at
      FROM contributors co
      WHERE co.created_by = ?
      ORDER BY LOWER(co.name) ASC, co.id ASC`;
    try {
      const [rows] = await pool.query(withHistory, [userId, userId]);
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return [];
      // sms_logs.recipient_id not migrated yet — list members without history
      const [rows] = await pool.query(
        'SELECT id, name, phone, created_at, NULL AS last_sms_at FROM contributors WHERE created_by = ? ORDER BY LOWER(name) ASC, id ASC',
        [userId]
      );
      return rows;
    }
  },

  async findMemberById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, phone, created_by FROM contributors WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async createMember({ name, phone, created_by }) {
    const [result] = await pool.query(
      'INSERT INTO contributors (name, phone, created_by) VALUES (?, ?, ?)',
      [name, phone, created_by]
    );
    return result.insertId;
  },

  async updateMember(id, { name, phone }) {
    await pool.query('UPDATE contributors SET name = ?, phone = ? WHERE id = ?', [name, phone, id]);
  },

  // Guard for deletion: a row still referenced by contributions belongs to the
  // contribution workflow and must never be removed by the member UI.
  async countContributions(id) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS n FROM contributions WHERE contributor_id = ?',
        [id]
      );
      return rows[0] ? Number(rows[0].n) : 0;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return 0;
      throw err;
    }
  },

  async deleteMember(id) {
    await pool.query('DELETE FROM contributors WHERE id = ?', [id]);
  },
};

module.exports = Contributor;
