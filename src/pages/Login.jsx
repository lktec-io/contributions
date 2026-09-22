import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiLogIn, FiEye, FiEyeOff, FiShield, FiActivity, FiUsers } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { getErrorMessage } from '../utils/helpers';
import './Login.css';

export default function Login() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);
  const [loading,      setLoading]      = useState(false);
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
      const user = await login(email.trim(), password, rememberMe);
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

      {/* ══════════════════════════════════════════
          BRAND PANEL — desktop only
          ══════════════════════════════════════════ */}
      <aside className="lp-brand" aria-hidden="true">
        <div className="lp-brand-top">
          <span className="lp-brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity=".9" />
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="lp-brand-name">Clix Notify</span>
        </div>

        <div className="lp-brand-body">
          <p className="lp-brand-eyebrow">Treasury &amp; Contribution System</p>
          <h2 className="lp-brand-headline">
            Every contribution<br />accounted for.
          </h2>
          <p className="lp-brand-copy">
            A single ledger for member contributions, campaign messaging and
            approval records — reconciled and ready when you are.
          </p>

          <ul className="lp-brand-points">
            <li className="lp-brand-point">
              <FiShield size={15} />
              <span>Role-scoped access with full ownership checks</span>
            </li>
            <li className="lp-brand-point">
              <FiActivity size={15} />
              <span>Live delivery status on every message sent</span>
            </li>
            <li className="lp-brand-point">
              <FiUsers size={15} />
              <span>Member records that stay clean and de-duplicated</span>
            </li>
          </ul>
        </div>

        <p className="lp-brand-foot">
          &copy; {new Date().getFullYear()} Clix Notify — All rights reserved
        </p>
      </aside>

      {/* ══════════════════════════════════════════
          SIGN-IN PANEL
          ══════════════════════════════════════════ */}
      <main className="lp-main">
        <div className="login-card">

          <div className="login-logo">
            <span className="login-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity=".9" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="login-app-name">Clix Notify</span>
          </div>

          <header className="lp-head">
            <p className="lp-eyebrow">Secure sign-in</p>
            <h1 className="lp-title">Welcome back</h1>
            <p className="lp-subtitle">Sign in to manage contributions and member messaging.</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit} noValidate>

            {/* Floating labels: the label sits after the input so CSS can react
                to :focus and :placeholder-shown. Placeholders are a single
                space so the field reads as empty until typed into. */}
            <div className="lp-field">
              <div className="lp-input-wrap">
                <FiMail className="lp-input-icon" size={16} aria-hidden="true" />
                <input
                  id="lp-email"
                  type="email"
                  className="lp-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder=" "
                  autoComplete="email"
                  disabled={loading}
                  required
                />
                <label htmlFor="lp-email" className="lp-label">Email address</label>
              </div>
            </div>

            <div className="lp-field">
              <div className="lp-input-wrap">
                <FiLock className="lp-input-icon" size={16} aria-hidden="true" />
                <input
                  id="lp-password"
                  type={showPassword ? 'text' : 'password'}
                  className="lp-input lp-input-pw"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder=" "
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <label htmlFor="lp-password" className="lp-label">Password</label>
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

            <div className="lp-row">
              <label className="lp-remember">
                <input
                  type="checkbox"
                  className="lp-remember-input"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span className="lp-remember-box" aria-hidden="true" />
                <span className="lp-remember-label">Remember me</span>
              </label>

              <Link to="/forgot-password" className="lp-forgot-link">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="lp-submit" disabled={loading}>
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
                  Sign in
                </span>
              )}
            </button>
          </form>

          <p className="login-footer-text">
            Protected workspace. Contact your administrator if you need access.
          </p>
        </div>
      </main>
    </div>
  );
}
