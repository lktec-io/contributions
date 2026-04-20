import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiLogIn, FiEye, FiEyeOff } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { getErrorMessage } from '../utils/helpers';
import './Login.css';

export default function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const { login }                       = useContext(AuthContext);
  const { toast }                       = useContext(ToastContext);
  const navigate                        = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.name) sessionStorage.setItem('justLoggedIn', user.name);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── Floating ambient blobs (decorative) ── */}
      <div className="login-blob login-blob-1" aria-hidden="true" />
      <div className="login-blob login-blob-2" aria-hidden="true" />
      <div className="login-blob login-blob-3" aria-hidden="true" />
      <div className="login-blob login-blob-4" aria-hidden="true" />

      {/* ── Card ──────────────────────────────── */}
      <div className="login-card">

        {/* Header */}
        <div className="login-logo">
          <div className="login-logo-mark">
            <span>FH</span>
          </div>
          <h1 className="login-app-name">Finance Hub</h1>
          <p className="login-tagline">Smart Contribution Management</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-icon-wrap">
              <FiMail className="input-icon" size={15} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-icon-wrap">
              <FiLock className="input-icon" size={15} />
              <div className="input-wrapper login-pass-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="login-loading">
                <span className="login-dots" aria-hidden="true">
                  <span /><span /><span />
                </span>
                Signing in…
              </span>
            ) : (
              <>
                <FiLogIn size={16} />
                Sign In
              </>
            )}
          </button>

        </form>

        <p className="login-footer-text">
          &copy; {new Date().getFullYear()} Finance Hub &mdash; All rights reserved
        </p>
      </div>
    </div>
  );
}
