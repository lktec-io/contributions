'use strict';

const pool = require('../config/db');

// MySQL error 1054 = "Unknown column" — column doesn't exist yet (migration pending)
const ERR_UNKNOWN_COLUMN = 1054;

const Contribution = {

  // ── findAll ─────────────────────────────────────────────────
  // If is_hidden column is missing, falls back to query without the filter.
  async findAll({ eventId, status, search, organizationId, createdBy } = {}) {
    const buildQuery = (includeHiddenFilter) => {
      let q = `
        SELECT c.id, c.event_id, c.contributor_id,
               COALESCE(co.name,  c.contributor_name) AS contributor_name,
               COALESCE(co.phone, c.phone)             AS phone,
               COALESCE(co.email, c.email)             AS email,
               c.amount, c.paid_amount, c.status, c.created_at, c.updated_at,
               e.name AS event_name, e.organization_id, e.created_by AS event_created_by
        FROM contributions c
        JOIN events e ON e.id = c.event_id
        LEFT JOIN contributors co ON co.id = c.contributor_id
        WHERE ${includeHiddenFilter ? 'c.is_hidden = FALSE' : '1=1'}
      `;
      const params = [];

      if (createdBy !== null && createdBy !== undefined) {
        q += ' AND e.created_by = ?';
        params.push(createdBy);
      }
      if (organizationId !== null && organizationId !== undefined) {
        q += ' AND e.organization_id = ?';
        params.push(organizationId);
      }
      if (eventId) {
        q += ' AND c.event_id = ?';
        params.push(eventId);
      }
      if (status) {
        q += ' AND c.status = ?';
        params.push(status);
      }
      if (search) {
        q += ' AND c.contributor_name LIKE ?';
        params.push(`%${search}%`);
      }

      q += ' ORDER BY c.created_at DESC';
      return { q, params };
    };

    try {
      const { q, params } = buildQuery(true);
      const [rows] = await pool.query(q, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_UNKNOWN_COLUMN) {
        // Column not yet added — fall back to query without is_hidden filter
        const { q, params } = buildQuery(false);
        const [rows] = await pool.query(q, params);
        return rows;
      }
      throw err;
    }
  },

  // ── findHidden ──────────────────────────────────────────────
  async findHidden({ organizationId, createdBy } = {}) {
    let query = `
      SELECT c.id, c.event_id, c.contributor_id,
             COALESCE(co.name,  c.contributor_name) AS contributor_name,
             COALESCE(co.phone, c.phone)             AS phone,
             COALESCE(co.email, c.email)             AS email,
             c.amount, c.paid_amount, c.status, c.created_at, c.hidden_at,
             e.name AS event_name, e.organization_id, e.created_by AS event_created_by
      FROM contributions c
      JOIN events e ON e.id = c.event_id
      LEFT JOIN contributors co ON co.id = c.contributor_id
      WHERE c.is_hidden = TRUE
    `;
    const params = [];

    if (createdBy !== null && createdBy !== undefined) {
      query += ' AND e.created_by = ?';
      params.push(createdBy);
    }
    if (organizationId !== null && organizationId !== undefined) {
      query += ' AND e.organization_id = ?';
      params.push(organizationId);
    }

    query += ' ORDER BY c.hidden_at DESC';
    const [rows] = await pool.query(query, params);
    return rows;
  },

  // ── findById ────────────────────────────────────────────────
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT c.id, c.event_id, c.contributor_id,
              COALESCE(co.name,  c.contributor_name) AS contributor_name,
              COALESCE(co.phone, c.phone)             AS phone,
              COALESCE(co.email, c.email)             AS email,
              c.amount, c.paid_amount, c.status, c.is_hidden, c.hidden_at,
              c.created_at, c.updated_at,
              e.name AS event_name, e.organization_id, e.created_by AS event_created_by
       FROM contributions c
       JOIN events e ON e.id = c.event_id
       LEFT JOIN contributors co ON co.id = c.contributor_id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  // ── create ──────────────────────────────────────────────────
  // contributor_id is optional (null for rows created before migration).
  // contributor_name/phone/email are always written for backward compat
  // (SMS, exports, etc. read directly from contributions).
  async create({ event_id, contributor_id, contributor_name, phone, email, amount }) {
    const [result] = await pool.query(
      `INSERT INTO contributions
         (event_id, contributor_id, contributor_name, phone, email, amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [event_id, contributor_id || null, contributor_name, phone || null, email || null, amount]
    );
    return result.insertId;
  },

  // ── update ──────────────────────────────────────────────────
  // Updates the contribution row and propagates name/phone/email changes
  // to the linked global contributor record so all events stay in sync.
  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await pool.query(`UPDATE contributions SET ${setClauses} WHERE id = ?`, values);

    // Propagate identity fields to the global contributors table
    const identityMap = { contributor_name: 'name', phone: 'phone', email: 'email' };
    const globalFields = {};
    for (const [contribKey, globalKey] of Object.entries(identityMap)) {
      if (fields[contribKey] !== undefined) globalFields[globalKey] = fields[contribKey];
    }

    if (Object.keys(globalFields).length > 0) {
      try {
        const [rows] = await pool.query(
          'SELECT contributor_id FROM contributions WHERE id = ?', [id]
        );
        const contributorId = rows[0]?.contributor_id;
        if (contributorId) {
          const upd    = Object.keys(globalFields).map(k => `${k} = ?`).join(', ');
          const upVals = [...Object.values(globalFields), contributorId];
          await pool.query(`UPDATE contributors SET ${upd} WHERE id = ?`, upVals);
        }
      } catch (err) {
        if (err.errno !== 1146) {
          console.error('[Contribution.update] Failed to sync contributors:', err.message);
        }
      }
    }
  },

  // ── delete ──────────────────────────────────────────────────
  async delete(id) {
    await pool.query('DELETE FROM contributions WHERE id = ?', [id]);
  },

  // ── hide / restore ──────────────────────────────────────────
  async hide(id) {
    await pool.query(
      'UPDATE contributions SET is_hidden = TRUE, hidden_at = NOW() WHERE id = ?',
      [id]
    );
  },

  async restore(id) {
    await pool.query(
      'UPDATE contributions SET is_hidden = FALSE, hidden_at = NULL WHERE id = ?',
      [id]
    );
  },

  // ── hideByOrganization / restoreByOrganization ──────────────
  // Cascade: called when a user (organization) is hidden/restored.
  // Hides/restores all contributions on events assigned to that user.
  async hideByOrganization(organizationId) {
    await pool.query(
      `UPDATE contributions c
       JOIN events e ON e.id = c.event_id
       SET c.is_hidden = TRUE, c.hidden_at = NOW()
       WHERE e.organization_id = ? AND c.is_hidden = FALSE`,
      [organizationId]
    );
  },

  async restoreByOrganization(organizationId) {
    await pool.query(
      `UPDATE contributions c
       JOIN events e ON e.id = c.event_id
       SET c.is_hidden = FALSE, c.hidden_at = NULL
       WHERE e.organization_id = ?`,
      [organizationId]
    );
  },

  // ── updatePaymentStatus ─────────────────────────────────────
  async updatePaymentStatus(id) {
    const [sumRows] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payment_history WHERE contribution_id = ?',
      [id]
    );
    const paidAmount = parseFloat(sumRows[0].total_paid);

    const [contribRows] = await pool.query(
      'SELECT amount FROM contributions WHERE id = ?',
      [id]
    );
    if (!contribRows.length) return null;

    const pledgeAmount = parseFloat(contribRows[0].amount);

    let status;
    if (paidAmount <= 0)                status = 'pledge';
    else if (paidAmount < pledgeAmount) status = 'partial';
    else                                status = 'paid';

    await pool.query(
      'UPDATE contributions SET paid_amount = ?, status = ? WHERE id = ?',
      [paidAmount, status, id]
    );

    return { paid_amount: paidAmount, status };
  },

  // ── getStats ────────────────────────────────────────────────
  // Falls back gracefully if is_hidden column doesn't exist yet.
  async getStats({ organizationId, createdBy } = {}) {
    const buildQuery = (includeHiddenFilter) => {
      let q = `
        SELECT
          COUNT(c.id)                     AS total_contributors,
          COALESCE(SUM(c.amount), 0)      AS total_pledged,
          COALESCE(SUM(c.paid_amount), 0) AS total_paid
        FROM contributions c
        JOIN events e ON e.id = c.event_id
        WHERE ${includeHiddenFilter ? 'c.is_hidden = FALSE' : '1=1'}
      `;
      const params = [];

      if (createdBy !== null && createdBy !== undefined) {
        q += ' AND e.created_by = ?';
        params.push(createdBy);
      }
      if (organizationId !== null && organizationId !== undefined) {
        q += ' AND e.organization_id = ?';
        params.push(organizationId);
      }
      return { q, params };
    };

    let row;
    try {
      const { q, params } = buildQuery(true);
      const [rows] = await pool.query(q, params);
      row = rows[0];
    } catch (err) {
      if (err.errno === ERR_UNKNOWN_COLUMN) {
        const { q, params } = buildQuery(false);
        const [rows] = await pool.query(q, params);
        row = rows[0];
      } else {
        throw err;
      }
    }

    return {
      total_contributors: row.total_contributors,
      total_pledged:      parseFloat(row.total_pledged),
      total_paid:         parseFloat(row.total_paid),
      outstanding:        parseFloat(row.total_pledged) - parseFloat(row.total_paid),
    };
  },
};

module.exports = Contribution;
