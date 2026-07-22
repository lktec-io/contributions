'use strict';

const pool = require('../config/db');

const PaymentRequest = {

  // ── create ──────────────────────────────────────────────────
  async create({ contribution_id, submitted_amount, reference_number, message }) {
    const [result] = await pool.query(
      `INSERT INTO payment_requests (contribution_id, submitted_amount, reference_number, message)
       VALUES (?, ?, ?, ?)`,
      [contribution_id, submitted_amount, reference_number || null, message || null]
    );
    return result.insertId;
  },

  // ── findById ────────────────────────────────────────────────
  async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM payment_requests WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // ── findLatestByContribution ────────────────────────────────
  // Drives the "pending verification" / "rejected" banner on the public page.
  async findLatestByContribution(contributionId) {
    const [rows] = await pool.query(
      `SELECT id, status, submitted_amount, submitted_at, reviewed_at
       FROM payment_requests
       WHERE contribution_id = ?
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [contributionId]
    );
    return rows[0] || null;
  },

  // ── findAllForScope ─────────────────────────────────────────
  // Isolation mirrors Contribution.findAll: admin sees own events plus
  // event_assignments-delegated ones, client_user strictly organization_id,
  // super_admin (no filter fields) sees everything.
  async findAllForScope({ createdBy, organizationId, status } = {}) {
    let q = `
      SELECT pr.id, pr.contribution_id, pr.submitted_amount, pr.reference_number,
             pr.message, pr.status, pr.submitted_at, pr.reviewed_at, pr.reviewed_by,
             c.contributor_name, c.phone, c.amount AS pledged_amount, c.paid_amount,
             e.name AS event_name, e.organization_id, e.created_by AS event_created_by
      FROM payment_requests pr
      JOIN contributions c ON c.id = pr.contribution_id
      JOIN events e ON e.id = c.event_id
      WHERE 1=1
    `;
    const params = [];

    if (createdBy !== null && createdBy !== undefined) {
      q += ` AND (e.created_by = ? OR EXISTS (
               SELECT 1 FROM event_assignments ea
               WHERE ea.event_id = e.id AND ea.user_id = ?
             ))`;
      params.push(createdBy, createdBy);
    }
    if (organizationId !== null && organizationId !== undefined) {
      q += ' AND e.organization_id = ?';
      params.push(organizationId);
    }
    if (status) {
      q += ' AND pr.status = ?';
      params.push(status);
    }

    q += ' ORDER BY pr.submitted_at DESC';

    const [rows] = await pool.query(q, params);
    return rows;
  },

  // ── approve / reject ────────────────────────────────────────
  async approve(id, reviewedBy) {
    await pool.query(
      "UPDATE payment_requests SET status = 'approved', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?",
      [reviewedBy, id]
    );
  },

  async reject(id, reviewedBy) {
    await pool.query(
      "UPDATE payment_requests SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?",
      [reviewedBy, id]
    );
  },
};

module.exports = PaymentRequest;
