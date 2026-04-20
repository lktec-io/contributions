import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiLogIn, FiEye, FiEyeOff } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { getErrorMessage } from '../utils/helpers';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      // Persist name for welcome popup across page load
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
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-mark">FH</div>
          <h1 className="login-app-name">Finance Hub</h1>
          <p className="login-tagline">Sign in to your account to continue</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-icon-wrap">
              <FiMail className="input-icon" size={16} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="finance@admin.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-icon-wrap">
              <FiLock className="input-icon" size={16} />
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
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="login-loading">
                <span className="login-spinner" />
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
              &copy; {new Date().getFullYear()} Finance Hub || All rights reserved
        </p>
      </div>
    </div>
  );
}
