require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const cookieParser = require('cookie-parser');
const pool       = require('./config/db');

const authRoutes         = require('./routes/authRoutes');
const userRoutes         = require('./routes/userRoutes');
const eventRoutes        = require('./routes/eventRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const contributorRoutes  = require('./routes/contributorRoutes');
const paymentRoutes      = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const exportRoutes       = require('./routes/exportRoutes');
const dashboardRoutes    = require('./routes/dashboardRoutes');
const smsRoutes          = require('./routes/smsRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const settingsRoutes     = require('./routes/settingsRoutes');
const errorHandler       = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 8001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://contribution.nardio.online',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/contributors',  contributorRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/sms',           smsRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/settings',      settingsRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errors: [] });
});

// ── Global error handler ────────────────────────────────────
app.use(errorHandler);

// ── Schema auto-migration ───────────────────────────────────
// Adds new columns to existing tables without touching any data.
// Safe to run repeatedly: error 1060 (Duplicate column) is silently ignored
async function ensureSchema() {
  const steps = [
    { col: 'contributions.is_hidden', sql: 'ALTER TABLE contributions ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE' },
    { col: 'contributions.hidden_at', sql: 'ALTER TABLE contributions ADD COLUMN hidden_at DATETIME NULL' },
    { col: 'users.is_hidden',         sql: 'ALTER TABLE users ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE' },
    { col: 'users.hidden_at',         sql: 'ALTER TABLE users ADD COLUMN hidden_at DATETIME NULL' },
    { col: 'users.reset_token',       sql: 'ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL' },
    { col: 'users.reset_expires',     sql: 'ALTER TABLE users ADD COLUMN reset_expires DATETIME NULL' },
  ];

  for (const step of steps) {
    try {
      await pool.query(step.sql);
      console.log(`[migration] Added column ${step.col}`);
    } catch (err) {
      if (err.errno === 1060) {
        // Column already exists — this is the normal case after first run
      } else {
        console.error(`[migration] Warning (${step.col}): ${err.message}`);
      }
    }
  }

  // Create sms_logs table (idempotent)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id      INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT         NOT NULL,
        type    VARCHAR(50) NOT NULL DEFAULT 'bulk',
        sent_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[migration] sms_logs table ready');
  } catch (err) {
    console.error('[migration] sms_logs table error:', err.message);
  }

  // Create event_assignments table (idempotent)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_assignments (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        event_id      INT            NOT NULL,
        user_id       INT            NOT NULL,
        target_amount DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_event_user (event_id, user_id)
      )
    `);
    console.log('[migration] event_assignments table ready');
  } catch (err) {
    console.error('[migration] event_assignments table error:', err.message);
  }

  // Create global contributors table (idempotent)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contributors (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(255)  NOT NULL,
        phone      VARCHAR(50)   NULL,
        email      VARCHAR(255)  NULL,
        created_by INT           NULL,
        created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_contributors_phone (phone),
        INDEX idx_contributors_email (email)
      )
    `);
    console.log('[migration] contributors table ready');
  } catch (err) {
    console.error('[migration] contributors table error:', err.message);
  }

  // Add contributor_id FK column to contributions (nullable, backward-compatible)
  try {
    await pool.query(
      'ALTER TABLE contributions ADD COLUMN contributor_id INT NULL'
    );
    console.log('[migration] Added contributions.contributor_id');
  } catch (err) {
    if (err.errno !== 1060) {
      console.error('[migration] contributions.contributor_id error:', err.message);
    }
  }

  // Add index on contributor_id (ignore error if already exists)
  try {
    await pool.query(
      'ALTER TABLE contributions ADD INDEX idx_contrib_contributor_id (contributor_id)'
    );
  } catch (_) { /* index may already exist */ }
}

// ── One-time data migration: populate global contributors table ─
// Processes only contributions where contributor_id IS NULL (idempotent).
async function migrateContributors() {
  try {
    const [rows] = await pool.query(
      'SELECT id, contributor_name, phone, email, created_at FROM contributions WHERE contributor_id IS NULL'
    );
    if (!rows.length) return;

    let migrated = 0;
    for (const c of rows) {
      try {
        let contributorId = null;

        const conditions = [];
        const params     = [];
        if (c.phone) { conditions.push('phone = ?'); params.push(c.phone); }
        if (c.email) { conditions.push('email = ?'); params.push(c.email); }

        if (conditions.length > 0) {
          const [existing] = await pool.query(
            `SELECT id FROM contributors WHERE ${conditions.join(' OR ')} LIMIT 1`,
            params
          );
          if (existing.length > 0) contributorId = existing[0].id;
        }

        if (!contributorId) {
          const [result] = await pool.query(
            'INSERT INTO contributors (name, phone, email, created_at) VALUES (?, ?, ?, ?)',
            [c.contributor_name, c.phone || null, c.email || null, c.created_at]
          );
          contributorId = result.insertId;
        }

        await pool.query(
          'UPDATE contributions SET contributor_id = ? WHERE id = ?',
          [contributorId, c.id]
        );
        migrated++;
      } catch (rowErr) {
        console.error(`[migration] Failed to migrate contribution ${c.id}:`, rowErr.message);
      }
    }

    if (migrated > 0) {
      console.log(`[migration] Migrated ${migrated} contribution(s) to global contributors`);
    }
  } catch (err) {
    // Contributors table may not exist yet on first run; ensureSchema creates it first
    if (err.errno !== 1146) {
      console.error('[migration] migrateContributors error:', err.message);
    }
  }
}

// ── Merge duplicate contributors ────────────────────────────
// Runs on every startup (idempotent). Finds contributors sharing
// the same phone OR email, keeps the earliest (min id), moves all
// contribution references to the keeper, then deletes the duplicates.
async function deduplicateContributors() {
  try {
    let merged = 0;

    // Deduplicate by phone
    const [phoneDups] = await pool.query(`
      SELECT phone, MIN(id) AS keep_id, COUNT(*) AS cnt
      FROM contributors
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING cnt > 1
    `);

    for (const dup of phoneDups) {
      const [toDelete] = await pool.query(
        'SELECT id FROM contributors WHERE phone = ? AND id != ?',
        [dup.phone, dup.keep_id]
      );
      const ids = toDelete.map(r => r.id);
      if (!ids.length) continue;
      const ph = ids.map(() => '?').join(',');
      await pool.query(
        `UPDATE contributions SET contributor_id = ? WHERE contributor_id IN (${ph})`,
        [dup.keep_id, ...ids]
      );
      await pool.query(`DELETE FROM contributors WHERE id IN (${ph})`, ids);
      merged += ids.length;
    }

    // Deduplicate by email (after phone pass, table is smaller)
    const [emailDups] = await pool.query(`
      SELECT email, MIN(id) AS keep_id, COUNT(*) AS cnt
      FROM contributors
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email
      HAVING cnt > 1
    `);

    for (const dup of emailDups) {
      const [toDelete] = await pool.query(
        'SELECT id FROM contributors WHERE email = ? AND id != ?',
        [dup.email, dup.keep_id]
      );
      const ids = toDelete.map(r => r.id);
      if (!ids.length) continue;
      const ph = ids.map(() => '?').join(',');
      await pool.query(
        `UPDATE contributions SET contributor_id = ? WHERE contributor_id IN (${ph})`,
        [dup.keep_id, ...ids]
      );
      await pool.query(`DELETE FROM contributors WHERE id IN (${ph})`, ids);
      merged += ids.length;
    }

    if (merged > 0) {
      console.log(`[migration] deduplicateContributors: merged ${merged} duplicate record(s)`);
    }
  } catch (err) {
    if (err.errno !== 1146) {
      console.error('[migration] deduplicateContributors error:', err.message);
    }
  }
}

// ── Cron: auto-delete contributions hidden for 30+ days ─────
// Wrapped in try/catch so a missing package or schema issue
// never brings down the server.
function startCron() {
  try {
    const cron = require('node-cron');
    cron.schedule('0 0 * * *', async () => {
      try {
        const [cResult] = await pool.query(
          `DELETE FROM contributions
           WHERE is_hidden = TRUE
           AND hidden_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        );
        if (cResult.affectedRows > 0) {
          console.log(`[cron] Auto-deleted ${cResult.affectedRows} contribution(s) hidden 30+ days`);
        }
      } catch (err) {
        console.error('[cron] Auto-delete contributions error:', err.message);
      }

      try {
        const [uResult] = await pool.query(
          `DELETE FROM users
           WHERE is_hidden = TRUE
           AND hidden_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        );
        if (uResult.affectedRows > 0) {
          console.log(`[cron] Auto-deleted ${uResult.affectedRows} user(s) hidden 30+ days`);
        }
      } catch (err) {
        console.error('[cron] Auto-delete users error:', err.message);
      }
    });
    console.log('[cron] Daily auto-delete job registered');
  } catch (err) {
    console.error('[cron] Failed to start cron job (non-fatal):', err.message);
  }
}

// ── Startup ─────────────────────────────────────────────────
async function start() {
  try {
    await ensureSchema();
  } catch (err) {
    console.error('[migration] Schema migration failed (non-fatal):', err.message);
  }

  try {
    await migrateContributors();
  } catch (err) {
    console.error('[migration] Contributor migration failed (non-fatal):', err.message);
  }

  try {
    await deduplicateContributors();
  } catch (err) {
    console.error('[migration] Deduplication failed (non-fatal):', err.message);
  }

  startCron();

  app.listen(PORT, () => {
    console.log(`ContribTrack server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('[startup] Fatal error:', err.message);
  process.exit(1);
});

module.exports = app;
