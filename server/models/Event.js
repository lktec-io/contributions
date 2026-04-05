const pool = require('../config/db');

const Event = {
  async findAll(organizationId) {
    let query = `
      SELECT e.id, e.name, e.description, e.target_amount, e.organization_id,
             e.created_by, e.created_at, e.updated_at,
             u.name AS owner_name, u.email AS owner_email
      FROM events e
      JOIN users u ON u.id = e.organization_id
    `;
    const params = [];
    if (organizationId !== null && organizationId !== undefined) {
      query += ' WHERE e.organization_id = ?';
      params.push(organizationId);
    }
    query += ' ORDER BY e.created_at DESC';
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
};

module.exports = Event;
