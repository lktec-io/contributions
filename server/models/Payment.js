const pool = require('../config/db');

const Payment = {
  async create({ contribution_id, amount, note, recorded_by }) {
    const [result] = await pool.query(
      'INSERT INTO payment_history (contribution_id, amount, note, recorded_by) VALUES (?, ?, ?, ?)',
      [contribution_id, amount, note || null, recorded_by]
    );
    return result.insertId;
  },

  async findByContribution(contribution_id) {
    const [rows] = await pool.query(
      `SELECT ph.id, ph.contribution_id, ph.amount, ph.payment_date, ph.note,
              ph.recorded_by, u.name AS recorded_by_name
       FROM payment_history ph
       JOIN users u ON u.id = ph.recorded_by
       WHERE ph.contribution_id = ?
       ORDER BY ph.payment_date DESC`,
      [contribution_id]
    );
    return rows;
  },
};

module.exports = Payment;
