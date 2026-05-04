'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool   = require('../config/db');
const { generateAccessToken, generateRefreshToken, getRefreshExpiry } = require('../config/jwt');

// nodemailer is NOT required at module load — only when an email is actually
// sent. This means a missing/broken nodemailer package will never prevent login.
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  // Warn about missing config — don't crash, let sendMail() fail naturally
  const missing = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'FRONTEND_URL']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.warn('[email] Missing env vars:', missing.join(', '));
  }

  try {
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: false,  // STARTTLS on port 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    _transporter.verify((error) => {
      if (error) {
        console.error('[email] CONFIG ERROR:', error.message);
        _transporter = null;  // force re-create on next request after config is fixed
      } else {
        console.log('[email] Service is ready');
      }
    });

    return _transporter;
  } catch (err) {
    console.error('[email] nodemailer unavailable:', err.message);
    return null;
  }
}

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'strict',
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password, remember_me = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required', errors: [] });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password', errors: [] });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact your administrator.', errors: [] });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password', errors: [] });
    }

    const accessToken  = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const expiresAt    = getRefreshExpiry();

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    const secure = process.env.NODE_ENV === 'production';
    // Persistent cookie (7 days) if remember_me, session cookie otherwise
    const cookieOpts = { ...COOKIE_BASE, secure };
    if (remember_me) cookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie('refreshToken', refreshToken, cookieOpts);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken, // also returned in body for client-side storage (remember-me)
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
async function refresh(req, res, next) {
  try {
    // Accept token from cookie (existing) OR request body (remember-me flow)
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token provided', errors: [] });
    }

    const [tokens] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    const storedToken = tokens[0];

    if (!storedToken) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token', errors: [] });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [storedToken.user_id]);
    const user = users[0];

    if (!user || !user.is_active) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
      return res.status(401).json({ success: false, message: 'User not found or inactive', errors: [] });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    return res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    }
    res.clearCookie('refreshToken');
    return res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required', errors: [] });
    }

    console.log('[forgot-password] Reset request for:', email.trim());

    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    // Anti-enumeration: don't reveal whether the address is registered.
    if (!users.length) {
      return res.json({ success: true, data: { message: 'If that email exists, a reset link has been sent.' } });
    }

    const user        = users[0];
    const resetToken   = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    try {
      await pool.query(
        'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
        [resetToken, resetExpires, user.id]
      );
    } catch (dbErr) {
      console.error('[forgot-password] DB update failed:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Reset service temporarily unavailable', errors: [] });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl    = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await getTransporter().sendMail({
        from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to:      user.email,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family:sans-serif">
            <h2>Password Reset</h2>
            <p>Hi <strong>${user.name}</strong>, click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">
              Reset Password
            </a>
            <p>This link expires in <strong>15 minutes</strong>.</p>
            <p style="font-size:12px;color:#888;">If you did not request this, ignore this email — your password will not change.</p>
            <p style="font-size:12px;color:#888;">Or copy this link: ${resetUrl}</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('[forgot-password] EMAIL SEND ERROR:', emailErr);
      return res.status(500).json({ success: false, message: 'Failed to send reset email', errors: [] });
    }

    console.log('[forgot-password] Reset email sent to:', user.email);
    return res.json({ success: true, data: { message: 'If that email exists, a reset link has been sent.' } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/reset-password ────────────────────────────────────────────
async function resetPassword(req, res, next) {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required', errors: [] });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters', errors: [] });
    }

    let users;
    try {
      [users] = await pool.query(
        'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
        [token]
      );
    } catch (dbErr) {
      console.error('[reset-password] DB query failed (migration may be pending):', dbErr.message);
      return res.status(500).json({ success: false, message: 'Reset service temporarily unavailable', errors: [] });
    }

    if (!users.length) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired', errors: [] });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hashed, users[0].id]
    );

    return res.json({ success: true, data: { message: 'Password reset successfully. You can now log in.' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, forgotPassword, resetPassword };
