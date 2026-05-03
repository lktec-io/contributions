require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const pool = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const exportRoutes = require('./routes/exportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const smsRoutes      = require('./routes/smsRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 8001;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://contribution.nardio.online',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sms',      smsRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/settings', settingsRoutes);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errors: [] });
});

// ── Global error handler ───────────────────────────────────
app.use(errorHandler);

// ── Auto-delete contributions hidden for 30+ days (runs daily at midnight) ────
cron.schedule('0 0 * * *', async () => {
  try {
    const [result] = await pool.query(
      `DELETE FROM contributions
       WHERE is_hidden = TRUE
       AND hidden_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    if (result.affectedRows > 0) {
      console.log(`[cron] Auto-deleted ${result.affectedRows} contribution(s) hidden for 30+ days`);
    }
  } catch (err) {
    console.error('[cron] Auto-delete error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`ContribTrack server running on port ${PORT}`);
});

module.exports = app;
