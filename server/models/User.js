'use strict';

const pool = require('../config/db');

const ERR_UNKNOWN_COLUMN = 1054;

const User = {

  // ── findAll ─────────────────────────────────────────────────
  // Excludes hidden users. Falls back to unfiltered query if the
  // is_hidden column hasn't been added yet (migration pending).
  async findAll({ createdBy, role } = {}) {
    const buildQuery = (includeHiddenFilter) => {
      let query = `SELECT id, name, email, role, is_active, created_at, created_by
                   FROM users
                   WHERE ${includeHiddenFilter ? 'is_hidden = FALSE' : '1=1'}`;
      const params = [];
      if (createdBy !== null && createdBy !== undefined) {
        query += ' AND created_by = ?';
        params.push(createdBy);
      }
      if (role !== null && role !== undefined) {
        query += ' AND role = ?';
        params.push(role);
      }
      query += ' ORDER BY created_at DESC';
      return { query, params };
    };

    try {
      const { query, params } = buildQuery(true);
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_UNKNOWN_COLUMN) {
        const { query, params } = buildQuery(false);
        const [rows] = await pool.query(query, params);
        return rows;
      }
      throw err;
    }
  },

  // ── findHidden ──────────────────────────────────────────────
  async findHidden({ createdBy } = {}) {
    let query = `SELECT id, name, email, role, is_active, created_at, hidden_at, created_by
                 FROM users
                 WHERE is_hidden = TRUE`;
    const params = [];
    if (createdBy !== null && createdBy !== undefined) {
      query += ' AND created_by = ?';
      params.push(createdBy);
    }
    query += ' ORDER BY hidden_at DESC';
    const [rows] = await pool.query(query, params);
    return rows;
  },

  // ── findById ────────────────────────────────────────────────
  // No hidden filter here — controllers need to load hidden users
  // for hide/restore/delete operations.
  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, created_by, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async create({ name, email, password, role = 'client_user', created_by = null }) {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, role, created_by]
    );
    return result.insertId;
  },

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await pool.query(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
  },

  async delete(id) {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  },

  async hide(id) {
    await pool.query(
      'UPDATE users SET is_hidden = TRUE, hidden_at = NOW() WHERE id = ?',
      [id]
    );
  },

  async restore(id) {
    await pool.query(
      'UPDATE users SET is_hidden = FALSE, hidden_at = NULL WHERE id = ?',
      [id]
    );
  },

  async toggleStatus(id) {
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
    const [rows] = await pool.query('SELECT is_active FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  // ── findClientUsers ─────────────────────────────────────────
  // Used for event-assignment dropdowns. Excludes hidden users.
  async findClientUsers({ createdBy } = {}) {
    const buildQuery = (includeHiddenFilter) => {
      let query = `SELECT id, name, email FROM users
                   WHERE role = 'client_user' AND is_active = 1
                   ${includeHiddenFilter ? 'AND is_hidden = FALSE' : ''}`;
      const params = [];
      if (createdBy !== null && createdBy !== undefined) {
        query += ' AND created_by = ?';
        params.push(createdBy);
      }
      query += ' ORDER BY name ASC';
      return { query, params };
    };

    try {
      const { query, params } = buildQuery(true);
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (err.errno === ERR_UNKNOWN_COLUMN) {
        const { query, params } = buildQuery(false);
        const [rows] = await pool.query(query, params);
        return rows;
      }
      throw err;
    }
  },
};

module.exports = User;
