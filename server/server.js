require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const cookieParser = require('cookie-parser');
const pool       = require('./config/db');

const authRoutes         = require('./routes/authRoutes');
const userRoutes         = require('./routes/userRoutes');
const eventRoutes        = require('./routes/eventRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
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
// Safe to run repeatedly: error 1060 (Duplicate column) is silently ignored.
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
    // Schema migration failed entirely — log but don't block startup
    console.error('[migration] Schema migration failed (non-fatal):', err.message);
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
