import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiArrowLeft, FiCheck } from 'react-icons/fi';
import axios from 'axios';
import './AuthExtra.css';

const API_BASE = import.meta.env.VITE_API_URL || 'https://contribution.nardio.online/api';

export default function ResetPassword() {
  const [searchParams]               = useSearchParams();
  const token                        = searchParams.get('token') || '';
  const navigate                     = useNavigate();

  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [done,         setDone]         = useState(false);
  const [error,        setError]        = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!token) { setError('Invalid reset link — please request a new one.'); return; }

    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-extra-page">
        <div className="ae-blob ae-blob-1" aria-hidden="true" />
        <div className="ae-blob ae-blob-2" aria-hidden="true" />
        <div className="ae-card ae-card-narrow">
          <h2 className="ae-title">Invalid Link</h2>
          <p className="ae-subtitle">This reset link is missing or malformed. Please request a new one.</p>
          <Link to="/forgot-password" className="ae-back-link">Request new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-extra-page">
      <div className="ae-blob ae-blob-1" aria-hidden="true" />
      <div className="ae-blob ae-blob-2" aria-hidden="true" />

      <div className="ae-card">
        <div className="ae-logo">
          <div className="ae-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity=".9"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="ae-app-name">Finance Hub</h1>
        </div>

        {done ? (
          <div className="ae-success">
            <div className="ae-success-icon ae-success-icon-green" aria-hidden="true">
              <FiCheck size={28} />
            </div>
            <h2 className="ae-title">Password Reset!</h2>
            <p className="ae-subtitle">
              Your password has been updated. Redirecting you to Sign In…
            </p>
            <Link to="/login" className="ae-back-link"><FiArrowLeft size={14} /> Sign In now</Link>
          </div>
        ) : (
          <>
            <h2 className="ae-title">Set New Password</h2>
            <p className="ae-subtitle">Choose a strong password for your account.</p>

            <form className="ae-form" onSubmit={handleSubmit} noValidate>
              <div className="ae-field">
                <label htmlFor="rp-password" className="ae-label">New Password</label>
                <div className="ae-input-wrap">
                  <FiLock className="ae-input-icon" size={16} aria-hidden="true" />
                  <input
                    id="rp-password"
                    type={showPw ? 'text' : 'password'}
                    className="ae-input ae-input-pw"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                  <button type="button" className="ae-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                    aria-label={showPw ? 'Hide' : 'Show'}>
                    {showPw ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <div className="ae-field">
                <label htmlFor="rp-confirm" className="ae-label">Confirm Password</label>
                <div className="ae-input-wrap">
                  <FiLock className="ae-input-icon" size={16} aria-hidden="true" />
                  <input
                    id="rp-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    className="ae-input ae-input-pw"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                  <button type="button" className="ae-pw-toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                    aria-label={showConfirm ? 'Hide' : 'Show'}>
                    {showConfirm ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
                {error && <p className="ae-field-error">{error}</p>}
              </div>

              <button type="submit" className="ae-submit" disabled={loading}>
                {loading ? (
                  <span className="ae-loading">
                    <span className="ae-dots"><span /><span /><span /></span>
                    Saving…
                  </span>
                ) : (
                  <span className="ae-btn-inner"><FiLock size={15} /> Reset Password</span>
                )}
              </button>
            </form>

            <Link to="/login" className="ae-back-link">
              <FiArrowLeft size={14} /> Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
