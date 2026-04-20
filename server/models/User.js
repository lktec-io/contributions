const pool = require('../config/db');

const User = {
  /**
   * Find all users.
   * - super_admin: only users they created (created_by = adminId)
   * Pass createdBy = null to get ALL (only if caller has authority to do so).
   */
  async findAll({ createdBy, role } = {}) {
    let query = 'SELECT id, name, email, role, is_active, created_at, created_by FROM users WHERE 1=1';
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
    const [rows] = await pool.query(query, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, created_by, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
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

  async toggleStatus(id) {
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
    const [rows] = await pool.query('SELECT is_active FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  /**
   * Find active client_users created by a specific admin.
   * Used to populate event assignment dropdowns.
   */
  async findClientUsers({ createdBy } = {}) {
    let query = "SELECT id, name, email FROM users WHERE role = 'client_user' AND is_active = 1";
    const params = [];

    if (createdBy !== null && createdBy !== undefined) {
      query += ' AND created_by = ?';
      params.push(createdBy);
    }

    query += ' ORDER BY name ASC';
    const [rows] = await pool.query(query, params);
    return rows;
  },
};

module.exports = User;
