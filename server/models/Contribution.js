const pool = require('../config/db');

const Contribution = {
  async findAll({ eventId, status, search, organizationId } = {}) {
    let query = `
      SELECT c.id, c.event_id, c.contributor_name, c.phone, c.email,
             c.amount, c.paid_amount, c.status, c.created_at, c.updated_at,
             e.name AS event_name, e.organization_id
      FROM contributions c
      JOIN events e ON e.id = c.event_id
      WHERE 1=1
    `;
    const params = [];

    if (organizationId !== null && organizationId !== undefined) {
      query += ' AND e.organization_id = ?';
      params.push(organizationId);
    }
    if (eventId) {
      query += ' AND c.event_id = ?';
      params.push(eventId);
    }
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND c.contributor_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC';
    const [rows] = await pool.query(query, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT c.*, e.name AS event_name, e.organization_id
       FROM contributions c
       JOIN events e ON e.id = c.event_id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ event_id, contributor_name, phone, email, amount }) {
    const [result] = await pool.query(
      'INSERT INTO contributions (event_id, contributor_name, phone, email, amount) VALUES (?, ?, ?, ?, ?)',
      [event_id, contributor_name, phone || null, email || null, amount]
    );
    return result.insertId;
  },

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await pool.query(`UPDATE contributions SET ${setClauses} WHERE id = ?`, values);
  },

  async delete(id) {
    await pool.query('DELETE FROM contributions WHERE id = ?', [id]);
  },

  async updatePaymentStatus(id) {
    // Recalculate paid_amount from SUM of payment_history
    const [sumRows] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payment_history WHERE contribution_id = ?',
      [id]
    );
    const paidAmount = parseFloat(sumRows[0].total_paid);

    // Fetch the pledge amount
    const [contribRows] = await pool.query(
      'SELECT amount FROM contributions WHERE id = ?',
      [id]
    );
    if (!contribRows.length) return null;

    const pledgeAmount = parseFloat(contribRows[0].amount);

    let status;
    if (paidAmount <= 0) {
      status = 'pledge';
    } else if (paidAmount < pledgeAmount) {
      status = 'partial';
    } else {
      status = 'paid';
    }

    await pool.query(
      'UPDATE contributions SET paid_amount = ?, status = ? WHERE id = ?',
      [paidAmount, status, id]
    );

    return { paid_amount: paidAmount, status };
  },

  async getStats(organizationId) {
    let query = `
      SELECT
        COUNT(c.id) AS total_contributors,
        COALESCE(SUM(c.amount), 0) AS total_pledged,
        COALESCE(SUM(c.paid_amount), 0) AS total_paid
      FROM contributions c
      JOIN events e ON e.id = c.event_id
    `;
    const params = [];
    if (organizationId !== null && organizationId !== undefined) {
      query += ' WHERE e.organization_id = ?';
      params.push(organizationId);
    }
    const [rows] = await pool.query(query, params);
    const row = rows[0];
    return {
      total_contributors: row.total_contributors,
      total_pledged: parseFloat(row.total_pledged),
      total_paid: parseFloat(row.total_paid),
      outstanding: parseFloat(row.total_pledged) - parseFloat(row.total_paid),
    };
  },
};

module.exports = Contribution;
