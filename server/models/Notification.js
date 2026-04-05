const pool = require('../config/db');

const Notification = {
  async create({ user_id, title, message, type = 'system' }) {
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [user_id, title, message, type]
    );
    return result.insertId;
  },

  async findByUser(user_id, limit = 20) {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [user_id, limit]
    );
    return rows;
  },

  async getUnreadCount(user_id) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [user_id]
    );
    return rows[0].count;
  },

  async markRead(id, user_id) {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, user_id]
    );
  },

  async markAllRead(user_id) {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [user_id]
    );
  },
};

module.exports = Notification;
