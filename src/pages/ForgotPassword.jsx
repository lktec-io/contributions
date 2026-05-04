import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiSend } from 'react-icons/fi';
import axios from 'axios';
import './AuthExtra.css';

const API_BASE = import.meta.env.VITE_API_URL || 'https://contribution.nardio.online/api';

export default function ForgotPassword() {
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/forgot-password`, { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

        {submitted ? (
          <div className="ae-success">
            <div className="ae-success-icon" aria-hidden="true">
              <FiMail size={28} />
            </div>
            <h2 className="ae-title">Check your inbox</h2>
            <p className="ae-subtitle">
              If <strong>{email}</strong> is registered, you'll receive a reset link within a minute.
              The link expires in 15 minutes.
            </p>
            <Link to="/login" className="ae-back-link">
              <FiArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h2 className="ae-title">Forgot Password?</h2>
            <p className="ae-subtitle">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form className="ae-form" onSubmit={handleSubmit} noValidate>
              <div className="ae-field">
                <label htmlFor="fp-email" className="ae-label">Email Address</label>
                <div className="ae-input-wrap">
                  <FiMail className="ae-input-icon" size={16} aria-hidden="true" />
                  <input
                    id="fp-email"
                    type="email"
                    className="ae-input"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </div>
                {error && <p className="ae-field-error">{error}</p>}
              </div>

              <button type="submit" className="ae-submit" disabled={loading}>
                {loading ? (
                  <span className="ae-loading">
                    <span className="ae-dots"><span /><span /><span /></span>
                    Sending…
                  </span>
                ) : (
                  <span className="ae-btn-inner"><FiSend size={15} /> Send Reset Link</span>
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
