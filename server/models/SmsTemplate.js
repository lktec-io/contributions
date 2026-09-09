'use strict';

const pool = require('../config/db');

const ERR_TABLE_NOT_EXISTS = 1146;

/*  Saved Custom SMS messages. Every query is scoped by user_id, so a template
    can only ever be read or written by the account that owns it.            */
const SmsTemplate = {

  async findAllByUser(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, title, message, created_at, updated_at
         FROM sms_templates
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [userId]
      );
      return rows;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return [];
      throw err;
    }
  },

  // Ownership is part of the lookup, not a check afterwards — another user's
  // id simply returns null.
  async findByIdForUser(id, userId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, title, message, created_at, updated_at
         FROM sms_templates
         WHERE id = ? AND user_id = ? LIMIT 1`,
        [id, userId]
      );
      return rows[0] || null;
    } catch (err) {
      if (err.errno === ERR_TABLE_NOT_EXISTS) return null;
      throw err;
    }
  },

  async create({ userId, title, message }) {
    const [result] = await pool.query(
      'INSERT INTO sms_templates (user_id, title, message) VALUES (?, ?, ?)',
      [userId, title, message]
    );
    return result.insertId;
  },

  async update(id, userId, { title, message }) {
    const [result] = await pool.query(
      'UPDATE sms_templates SET title = ?, message = ? WHERE id = ? AND user_id = ?',
      [title, message, id, userId]
    );
    return result.affectedRows > 0;
  },

  async remove(id, userId) {
    const [result] = await pool.query(
      'DELETE FROM sms_templates WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = SmsTemplate;
