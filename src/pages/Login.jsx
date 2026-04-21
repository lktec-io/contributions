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

      {/* ── Animated background blobs ── */}
      <div className="lp-blob lp-blob-1" aria-hidden="true" />
      <div className="lp-blob lp-blob-2" aria-hidden="true" />
      <div className="lp-blob lp-blob-3" aria-hidden="true" />
      <div className="lp-blob lp-blob-4" aria-hidden="true" />
      <div className="lp-blob lp-blob-5" aria-hidden="true" />

      {/* ── Glass card ── */}
      <div className="login-card">

        {/* Header */}
        <div className="login-logo">
          <div className="login-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity=".9"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="login-app-name">Finance Hub</h1>
          <p className="login-tagline">Smart Contribution Management</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>

          <div className="lp-field">
            <label htmlFor="lp-email" className="lp-label">Email Address</label>
            <div className="lp-input-wrap">
              <FiMail className="lp-input-icon" size={16} aria-hidden="true" />
              <input
                id="lp-email"
                type="email"
                className="lp-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="lp-field">
            <label htmlFor="lp-password" className="lp-label">Password</label>
            <div className="lp-input-wrap">
              <FiLock className="lp-input-icon" size={16} aria-hidden="true" />
              <input
                id="lp-password"
                type={showPassword ? 'text' : 'password'}
                className="lp-input lp-input-pw"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="lp-pw-toggle"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="lp-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="lp-loading-inner">
                <span className="lp-dots" aria-hidden="true">
                  <span /><span /><span />
                </span>
                Signing in…
              </span>
            ) : (
              <span className="lp-btn-inner">
                <FiLogIn size={16} />
                Sign In
              </span>
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
