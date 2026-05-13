const pool = require('../config/db');

async function getAdminStats(req, res, next) {
  try {
    const { role, userId } = req.user;
    const isSuperAdmin = role === 'super_admin';

    // ── Users count ──────────────────────────────────────────
    const [usersRow] = isSuperAdmin
      ? await pool.query("SELECT COUNT(*) AS count FROM users WHERE role IN ('admin','client_user')")
      : await pool.query(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'client_user' AND created_by = ?",
          [userId]
        );

    // ── Events count ─────────────────────────────────────────
    const [eventsRow] = isSuperAdmin
      ? await pool.query('SELECT COUNT(*) AS count FROM events')
      : await pool.query('SELECT COUNT(*) AS count FROM events WHERE created_by = ?', [userId]);

    // ── Contributions & collected ─────────────────────────────
    const [contribRow] = isSuperAdmin
      ? await pool.query(
          `SELECT
             COUNT(c.id)                                                                            AS count,
             COALESCE(SUM(c.paid_amount), 0)                                                       AS total,
             COALESCE(SUM(CASE WHEN c.status = 'partial' THEN (c.amount - c.paid_amount) ELSE 0 END), 0) AS pending_sum,
             COALESCE(SUM(CASE WHEN c.status = 'pledge'  THEN c.amount                  ELSE 0 END), 0) AS unpaid_sum
           FROM contributions c`
        )
      : await pool.query(
          `SELECT
             COUNT(c.id)                                                                            AS count,
             COALESCE(SUM(c.paid_amount), 0)                                                       AS total,
             COALESCE(SUM(CASE WHEN c.status = 'partial' THEN (c.amount - c.paid_amount) ELSE 0 END), 0) AS pending_sum,
             COALESCE(SUM(CASE WHEN c.status = 'pledge'  THEN c.amount                  ELSE 0 END), 0) AS unpaid_sum
           FROM contributions c
           JOIN events e ON e.id = c.event_id
           WHERE e.created_by = ?`,
          [userId]
        );

    // ── Recent activity ───────────────────────────────────────
    const [recentActivity] = isSuperAdmin
      ? await pool.query(
          `SELECT c.id, c.contributor_name, c.amount, c.paid_amount, c.status, c.created_at,
                  e.name AS event_name
           FROM contributions c
           JOIN events e ON e.id = c.event_id
           ORDER BY c.created_at DESC LIMIT 10`
        )
      : await pool.query(
          `SELECT c.id, c.contributor_name, c.amount, c.paid_amount, c.status, c.created_at,
                  e.name AS event_name
           FROM contributions c
           JOIN events e ON e.id = c.event_id
           WHERE e.created_by = ?
           ORDER BY c.created_at DESC LIMIT 10`,
          [userId]
        );

    const paidAmount    = parseFloat(contribRow[0].total);
    const pendingAmount = parseFloat(contribRow[0].pending_sum);
    const unpaidAmount  = parseFloat(contribRow[0].unpaid_sum);

    return res.json({
      success: true,
      data: {
        totalUsers:         usersRow[0].count,
        totalEvents:        eventsRow[0].count,
        totalContributions: contribRow[0].count,
        totalCollected:     paidAmount,
        chartData: { paid: paidAmount, pending: pendingAmount, unpaid: unpaidAmount },
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getClientStats(req, res, next) {
  try {
    const ERR_TABLE_NOT_EXISTS = 1146;
    const orgId = req.user.userId;

    // Collect all event IDs where the user is primary owner OR an assigned user
    let eventIds;
    try {
      const [rows] = await pool.query(
        `SELECT DISTINCT e.id FROM events e
         LEFT JOIN event_assignments ea ON ea.event_id = e.id
         WHERE e.organization_id = ? OR ea.user_id = ?`,
        [orgId, orgId]
      );
      eventIds = rows.map(r => r.id);
    } catch (err) {
      if (err.errno !== ERR_TABLE_NOT_EXISTS) throw err;
      const [rows] = await pool.query('SELECT id FROM events WHERE organization_id = ?', [orgId]);
      eventIds = rows.map(r => r.id);
    }

    if (eventIds.length === 0) {
      return res.json({
        success: true,
        data: {
          myEvents: 0, myContributors: 0,
          totalPledged: 0, totalPaid: 0, outstanding: 0,
          chartData: { paid: 0, pending: 0, unpaid: 0 },
          recentContributions: [],
        },
      });
    }

    const placeholders = eventIds.map(() => '?').join(',');

    const [[contribRow]] = await pool.query(
      `SELECT COUNT(c.id) AS count,
              COALESCE(SUM(c.amount), 0)      AS total_pledged,
              COALESCE(SUM(c.paid_amount), 0) AS total_paid,
              COALESCE(SUM(CASE WHEN c.status = 'partial' THEN (c.amount - c.paid_amount) ELSE 0 END), 0) AS pending_sum,
              COALESCE(SUM(CASE WHEN c.status = 'pledge'  THEN c.amount                  ELSE 0 END), 0) AS unpaid_sum
       FROM contributions c
       WHERE c.event_id IN (${placeholders})`,
      eventIds
    );

    const [recentContributions] = await pool.query(
      `SELECT c.id, c.contributor_name, c.amount, c.paid_amount, c.status, c.created_at,
              e.name AS event_name
       FROM contributions c
       JOIN events e ON e.id = c.event_id
       WHERE c.event_id IN (${placeholders})
       ORDER BY c.created_at DESC LIMIT 5`,
      eventIds
    );

    const totalPledged = parseFloat(contribRow.total_pledged);
    const totalPaid    = parseFloat(contribRow.total_paid);

    return res.json({
      success: true,
      data: {
        myEvents:           eventIds.length,
        myContributors:     contribRow.count,
        totalPledged,
        totalPaid,
        outstanding:        totalPledged - totalPaid,
        chartData: {
          paid:    totalPaid,
          pending: parseFloat(contribRow.pending_sum),
          unpaid:  parseFloat(contribRow.unpaid_sum),
        },
        recentContributions,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAdminStats, getClientStats };
