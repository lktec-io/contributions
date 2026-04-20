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
          `SELECT COUNT(c.id) AS count, COALESCE(SUM(c.paid_amount), 0) AS total
           FROM contributions c`
        )
      : await pool.query(
          `SELECT COUNT(c.id) AS count, COALESCE(SUM(c.paid_amount), 0) AS total
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

    return res.json({
      success: true,
      data: {
        totalUsers:         usersRow[0].count,
        totalEvents:        eventsRow[0].count,
        totalContributions: contribRow[0].count,
        totalCollected:     parseFloat(contribRow[0].total),
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getClientStats(req, res, next) {
  try {
    const orgId = req.user.userId;

    const [[eventsRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM events WHERE organization_id = ?',
      [orgId]
    );

    const [[contribRow]] = await pool.query(
      `SELECT COUNT(c.id) AS count,
              COALESCE(SUM(c.amount), 0) AS total_pledged,
              COALESCE(SUM(c.paid_amount), 0) AS total_paid
       FROM contributions c
       JOIN events e ON e.id = c.event_id
       WHERE e.organization_id = ?`,
      [orgId]
    );

    const [recentContributions] = await pool.query(
      `SELECT c.id, c.contributor_name, c.amount, c.paid_amount, c.status, c.created_at,
              e.name AS event_name
       FROM contributions c
       JOIN events e ON e.id = c.event_id
       WHERE e.organization_id = ?
       ORDER BY c.created_at DESC LIMIT 5`,
      [orgId]
    );

    const totalPledged = parseFloat(contribRow.total_pledged);
    const totalPaid    = parseFloat(contribRow.total_paid);

    return res.json({
      success: true,
      data: {
        myEvents:           eventsRow.count,
        myContributors:     contribRow.count,
        totalPledged,
        totalPaid,
        outstanding:        totalPledged - totalPaid,
        recentContributions,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAdminStats, getClientStats };
