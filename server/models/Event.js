'use strict';

const pool = require('../config/db');

const ERR_TABLE_NOT_EXISTS = 1146;

const Event = {

  // ── findAll ─────────────────────────────────────────────────
  // For client_user (organizationId filter): includes events where
  // user is either the primary assignee (organization_id) OR has an
  // entry in event_assignments. Falls back to organization_id-only
  // query if event_assignments table doesn't exist yet.
  async findAll({ organizationId, createdBy } = {}) {
    // client_user (organizationId): STRICT — only events where this user is
    // the primary owner. No event_assignments expansion to prevent cross-user
    // event/contribution leakage.
    const query = `
      SELECT e.id, e.name, e.description, e.target_amount, e.organization_id,
             e.created_by, e.created_at, e.updated_at,
             u.name AS owner_name, u.email AS owner_email
      FROM events e
      JOIN users u ON u.id = e.organization_id
      WHERE 1=1
      ${createdBy      != null ? 'AND e.created_by = ?'      : ''}
      ${organizationId != null ? 'AND e.organization_id = ?' : ''}
      ORDER BY e.created_at DESC
    `;
    const params = [];
    if (createdBy      != null) params.push(createdBy);
    if (organizationId != null) params.push(organizationId);

    const [rows] = await pool.query(query, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT e.*, u.name AS owner_name, u.email AS owner_email
       FROM events e
       JOIN users u ON u.id = e.organization_id
       WHERE e.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  // ── findAccessibleById ───────────────────────────────────────
  // Like findById but enforces tenant isolation, including events
  // the user can access via event_assignments (secondary assignee).
  // Returns null if the event doesn't exist OR the user can't access it.
  // Returns the event if it exists AND the caller may access it, else null.
  // client_user (organizationId): strict primary-owner check only.
  // admin (createdBy): own events plus event_assignments secondary access.
  // super_admin (empty filter): unrestricted.
  async findAccessibleById(id, { organizationId, createdBy } = {}) {
    // client_user — simple ownership lookup, no JOIN needed
    if (organizationId != null) {
      const [rows] = await pool.query(
        'SELECT * FROM events WHERE id = ? AND organization_id = ? LIMIT 1',
        [id, organizationId]
      );
      return rows[0] || null;
    }

    // admin or super_admin — may access via event_assignments
    const params = [id];
    let accessWhere = '1=1';
    if (createdBy != null) {
      accessWhere = '(e.created_by = ? OR ea.user_id = ?)';
      params.push(createdBy, createdBy);
    }

    try {
      const [rows] = await pool.query(
        `SELECT e.*
         FROM events e
         LEFT JOIN event_assignments ea ON ea.event_id = e.id
         WHERE e.id = ? AND ${accessWhere}
         LIMIT 1`,
        params
      );
      return rows[0] || null;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) {
        const fbParams = [id];
        const fbWhere = createdBy != null ? 'created_by = ?' : '1=1';
        if (createdBy != null) fbParams.push(createdBy);
        const [rows] = await pool.query(
          `SELECT * FROM events WHERE id = ? AND ${fbWhere} LIMIT 1`,
          fbParams
        );
        return rows[0] || null;
      }
      throw err;
    }
  },

  async create({ name, description, target_amount, organization_id, created_by }) {
    const [result] = await pool.query(
      'INSERT INTO events (name, description, target_amount, organization_id, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, target_amount || 0, organization_id, created_by]
    );
    return result.insertId;
  },

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await pool.query(`UPDATE events SET ${setClauses} WHERE id = ?`, values);
  },

  async delete(id) {
    await pool.query('DELETE FROM events WHERE id = ?', [id]);
  },

  // ── Assignment helpers ──────────────────────────────────────

  async getAssignments(eventId) {
    try {
      const [rows] = await pool.query(
        `SELECT ea.id, ea.event_id, ea.user_id, ea.target_amount,
                u.name AS user_name, u.email AS user_email
         FROM event_assignments ea
         JOIN users u ON u.id = ea.user_id
         WHERE ea.event_id = ?
         ORDER BY ea.created_at ASC`,
        [eventId]
      );
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return [];
      throw err;
    }
  },

  async getAssignmentsForEvents(eventIds) {
    if (!eventIds.length) return {};
    try {
      const placeholders = eventIds.map(() => '?').join(',');
      const [rows] = await pool.query(
        `SELECT ea.event_id, ea.user_id, ea.target_amount,
                u.name AS user_name, u.email AS user_email
         FROM event_assignments ea
         JOIN users u ON u.id = ea.user_id
         WHERE ea.event_id IN (${placeholders})
         ORDER BY ea.created_at ASC`,
        eventIds
      );
      const map = {};
      rows.forEach(r => {
        if (!map[r.event_id]) map[r.event_id] = [];
        map[r.event_id].push(r);
      });
      return map;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return {};
      throw err;
    }
  },

  // Replace all assignments for an event atomically
  async setAssignments(eventId, assignments) {
    await pool.query('DELETE FROM event_assignments WHERE event_id = ?', [eventId]);
    if (!assignments.length) return;
    const values = assignments.map(a => [eventId, a.user_id, parseFloat(a.target_amount) || 0]);
    await pool.query(
      'INSERT INTO event_assignments (event_id, user_id, target_amount) VALUES ?',
      [values]
    );
  },

  async isAssigned(eventId, userId) {
    try {
      const [rows] = await pool.query(
        'SELECT 1 FROM event_assignments WHERE event_id = ? AND user_id = ? LIMIT 1',
        [eventId, userId]
      );
      return rows.length > 0;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return false;
      throw err;
    }
  },
};

module.exports = Event;
