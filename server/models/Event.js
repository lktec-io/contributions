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
    const buildQuery = (withAssignments) => {
      let query = withAssignments
        ? `SELECT DISTINCT e.id, e.name, e.description, e.target_amount, e.organization_id,
                  e.created_by, e.created_at, e.updated_at,
                  u.name AS owner_name, u.email AS owner_email
           FROM events e
           JOIN users u ON u.id = e.organization_id
           LEFT JOIN event_assignments ea ON ea.event_id = e.id
           WHERE 1=1`
        : `SELECT e.id, e.name, e.description, e.target_amount, e.organization_id,
                  e.created_by, e.created_at, e.updated_at,
                  u.name AS owner_name, u.email AS owner_email
           FROM events e
           JOIN users u ON u.id = e.organization_id
           WHERE 1=1`;

      const params = [];
      if (createdBy !== null && createdBy !== undefined) {
        query += ' AND e.created_by = ?';
        params.push(createdBy);
      }
      if (organizationId !== null && organizationId !== undefined) {
        if (withAssignments) {
          query += ' AND (e.organization_id = ? OR ea.user_id = ?)';
          params.push(organizationId, organizationId);
        } else {
          query += ' AND e.organization_id = ?';
          params.push(organizationId);
        }
      }
      query += ' ORDER BY e.created_at DESC';
      return { query, params };
    };

    try {
      const { query, params } = buildQuery(true);
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) {
        const { query, params } = buildQuery(false);
        const [rows] = await pool.query(query, params);
        return rows;
      }
      throw err;
    }
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
