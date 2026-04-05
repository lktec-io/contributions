const pool = require('../config/db');

const User = {
  async findAll() {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
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

  async findClientUsers() {
    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'client_user' AND is_active = 1 ORDER BY name ASC"
    );
    return rows;
  },
};

module.exports = User;
