'use strict';

const pool = require('../config/db');

/*  Read-only reporting over sms_history.

    Scope mirrors the existing model: super_admin sees every row, everyone
    else sees only rows they sent. The scope is applied in SQL, never in the
    client, and every value is passed as a bound parameter.

    There are no write endpoints here by design — historical SMS records are
    never edited or deleted from this module.                                */

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX     = 100;

/** WHERE fragment + params that restrict rows to what this user may read. */
function scopeFor(req) {
  if (req.user.role === 'super_admin') return { sql: '1=1', params: [] };
  return { sql: 'h.user_id = ?', params: [req.user.userId] };
}

/** Builds the shared filter clause for list and summary. */
function buildFilters(req) {
  const scope  = scopeFor(req);
  const where  = [scope.sql];
  const params = [...scope.params];

  const status = String(req.query.status || '').trim().toLowerCase();
  if (status === 'sent' || status === 'failed') {
    where.push('h.status = ?');
    params.push(status);
  }

  const type = String(req.query.type || '').trim();
  if (type) {
    where.push('h.type = ?');
    params.push(type);
  }

  // Dates arrive as YYYY-MM-DD. `to` is inclusive of the whole day.
  const from = String(req.query.from || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push('h.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  const to = String(req.query.to || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push('h.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }

  const search = String(req.query.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where.push(`(
      h.recipient_name LIKE ? OR
      h.phone          LIKE ? OR
      h.event_name     LIKE ? OR
      h.message        LIKE ? OR
      h.status         LIKE ? OR
      h.error_text     LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  return { where: where.join(' AND '), params };
}

// ── GET /api/sms-history ────────────────────────────────────────
// Server-side search, filter and pagination. Only one page of rows ever
// leaves the database.
async function list(req, res, next) {
  try {
    const { where, params } = buildFilters(req);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT, 1),
      PAGE_SIZE_MAX,
    );
    const page   = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM sms_history h WHERE ${where}`,
      params,
    );

    // Message is truncated in the list; the full body is served by detail().
    const [rows] = await pool.query(
      `SELECT h.id, h.recipient_id, h.recipient_name, h.phone, h.event_name,
              h.type, h.status, h.created_at,
              LEFT(h.message, 140) AS message_preview,
              CHAR_LENGTH(h.message) AS message_length,
              LEFT(h.error_text, 160) AS error_preview
         FROM sms_history h
        WHERE ${where}
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.json({
      success: true,
      data: {
        logs: rows,
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
        count: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/sms-history/summary ────────────────────────────────
// Counts derived from the same scope and filters as the list.
async function summary(req, res, next) {
  try {
    const { where, params } = buildFilters(req);

    const [[row]] = await pool.query(
      `SELECT
         COUNT(*)                                                   AS total,
         SUM(CASE WHEN h.status = 'sent'   THEN 1 ELSE 0 END)       AS sent,
         SUM(CASE WHEN h.status = 'failed' THEN 1 ELSE 0 END)       AS failed,
         SUM(CASE WHEN DATE(h.created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
         SUM(CASE WHEN h.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                  THEN 1 ELSE 0 END)                                AS last7
       FROM sms_history h
       WHERE ${where}`,
      params,
    );

    return res.json({
      success: true,
      data: {
        total:  Number(row.total  || 0),
        sent:   Number(row.sent   || 0),
        failed: Number(row.failed || 0),
        today:  Number(row.today  || 0),
        last7:  Number(row.last7  || 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/sms-history/:id ────────────────────────────────────
// Full record, including the complete message body and provider error.
async function detail(req, res, next) {
  try {
    const scope = scopeFor(req);
    const [rows] = await pool.query(
      `SELECT h.id, h.user_id, h.recipient_id, h.recipient_name, h.phone,
              h.event_name, h.type, h.status, h.message, h.error_text, h.created_at
         FROM sms_history h
        WHERE h.id = ? AND ${scope.sql}
        LIMIT 1`,
      [req.params.id, ...scope.params],
    );

    // A row owned by someone else is simply not found — the same shape a
    // genuinely missing id returns, so nothing leaks about other users.
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'SMS log not found', errors: [] });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, summary, detail };
