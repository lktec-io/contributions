'use strict';

const pool = require('../config/db');

const ERR_TABLE_NOT_EXISTS = 1146;

const Contributor = {

  // ── findOrCreate ─────────────────────────────────────────────
  // Deduplicates by phone OR email. Returns the contributor id.
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

  // ── findAll ──────────────────────────────────────────────────
  // Returns one row per UNIQUE contributor with aggregate totals.
  // Supports search (name/phone/email), eventId, status, and tenant filters.
  // Uses INNER JOIN so only contributors with accessible contributions are returned.
  async findAll({ organizationId, createdBy, eventId, status, search } = {}) {
    try {
      const joinConditions = ['c.is_hidden = FALSE'];
      const params = [];

      if (eventId) {
        joinConditions.push('c.event_id = ?');
        params.push(eventId);
      }
      if (status) {
        joinConditions.push('c.status = ?');
        params.push(status);
      }
      if (createdBy !== null && createdBy !== undefined) {
        joinConditions.push('e.created_by = ?');
        params.push(createdBy);
      } else if (organizationId !== null && organizationId !== undefined) {
        joinConditions.push('e.organization_id = ?');
        params.push(organizationId);
      }

      const havingParts = [];
      if (search) {
        havingParts.push('(co.name LIKE ? OR co.phone LIKE ? OR co.email LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const query = `
        SELECT co.id, co.name, co.phone, co.email, co.created_at,
               COUNT(DISTINCT c.event_id)       AS event_count,
               COALESCE(SUM(c.amount),      0)  AS total_pledged,
               COALESCE(SUM(c.paid_amount), 0)  AS total_paid
        FROM contributors co
        JOIN contributions c ON c.contributor_id = co.id AND ${joinConditions.join(' AND ')}
        JOIN events e         ON e.id = c.event_id
        GROUP BY co.id
        ${havingParts.length ? `HAVING ${havingParts.join(' AND ')}` : ''}
        ORDER BY co.name ASC
      `;

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return [];
      throw err;
    }
  },

  // ── findById ─────────────────────────────────────────────────
  // Returns one contributor + all their accessible event assignments.
  async findById(id, { organizationId, createdBy } = {}) {
    try {
      const [contributors] = await pool.query(
        'SELECT id, name, phone, email, created_at FROM contributors WHERE id = ?',
        [id]
      );
      if (!contributors.length) return null;
      const contributor = contributors[0];

      // Event assignments scoped to this user's accessible events
      const whereConditions = ['c.contributor_id = ?', 'c.is_hidden = FALSE'];
      const params = [id];

      if (createdBy !== null && createdBy !== undefined) {
        whereConditions.push('e.created_by = ?');
        params.push(createdBy);
      } else if (organizationId !== null && organizationId !== undefined) {
        whereConditions.push('e.organization_id = ?');
        params.push(organizationId);
      }

      const [events] = await pool.query(
        `SELECT c.id AS contribution_id, c.event_id, c.amount, c.paid_amount,
                c.status, c.created_at, e.name AS event_name
         FROM contributions c
         JOIN events e ON e.id = c.event_id
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY c.created_at DESC`,
        params
      );

      return { ...contributor, events };
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return null;
      throw err;
    }
  },

  // ── search ───────────────────────────────────────────────────
  // Autocomplete: search by name, phone, or email, scoped to tenant.
  async search(q, { organizationId, createdBy } = {}) {
    try {
      let query = `
        SELECT DISTINCT co.id, co.name, co.phone, co.email
        FROM contributors co
        JOIN contributions c  ON c.contributor_id = co.id AND c.is_hidden = FALSE
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
};

module.exports = Contributor;
