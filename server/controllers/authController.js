const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { generateAccessToken, generateRefreshToken, getRefreshExpiry } = require('../config/jwt');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

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

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshExpiry();

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    const secure = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, secure });

    return res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

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

async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    }
    res.clearCookie('refreshToken');
    return res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout };
