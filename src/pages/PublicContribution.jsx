import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi';
import { publicService } from '../services/publicService';
import { formatCurrency, formatDateTime, getStatusBadgeClass } from '../utils/formatters';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './PublicContribution.css';

export default function PublicContribution() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ submitted_amount: '', reference_number: '', message: '' });

  const load = useCallback(async () => {
    try {
      const res = await publicService.getContribution(token);
      setData(res.data.data);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await publicService.submitPaymentRequest(token, form);
      setSubmitted(true);
      setModalOpen(false);
      await load();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="public-page public-page-centered">
        <LoadingSpinner />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="public-page public-page-centered">
        <div className="public-error-card">
          <FiXCircle size={40} className="public-error-icon" />
          <h1>Link Invalid</h1>
          <p>This contribution link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const {
    event_name, contributor_name, target_amount, paid_amount, balance,
    progress_percent, status, updated_at, payment_methods, latest_request,
  } = data;

  const hasPaymentMethods = payment_methods && Object.keys(payment_methods).length > 0;
  const isPending = latest_request?.status === 'pending';
  const isRejected = latest_request?.status === 'rejected' && !submitted;

  const methodLabels = { payment_mpesa: 'M-Pesa', payment_mixx: 'Mixx', payment_bank: 'Bank' };

  return (
    <div className="public-page">
      <div className="public-card">
        <div className="public-card-header">
          <span className="public-event-name">{event_name}</span>
          <span className={getStatusBadgeClass(status)}>{status}</span>
        </div>

        <h1 className="public-contributor-name">{contributor_name}</h1>

        <div className="public-progress-wrap">
          <div className="public-progress-track">
            <div className="public-progress-fill" style={{ width: `${progress_percent}%` }} />
          </div>
          <span className="public-progress-label">{progress_percent}% complete</span>
        </div>

        <div className="public-amounts-grid">
          <div className="public-amount-tile">
            <span className="public-amount-label">Target</span>
            <span className="public-amount-value">{formatCurrency(target_amount)}</span>
          </div>
          <div className="public-amount-tile">
            <span className="public-amount-label">Paid</span>
            <span className="public-amount-value public-amount-paid">{formatCurrency(paid_amount)}</span>
          </div>
          <div className="public-amount-tile">
            <span className="public-amount-label">Balance</span>
            <span className="public-amount-value public-amount-balance">{formatCurrency(balance)}</span>
          </div>
        </div>

        <p className="public-updated-at">Last updated: {formatDateTime(updated_at)}</p>

        {hasPaymentMethods && (
          <div className="public-methods">
            <h2 className="public-methods-title">Payment Methods</h2>
            <ul className="public-methods-list">
              {Object.entries(payment_methods).map(([key, value]) => (
                <li key={key} className="public-method-item">
                  <span className="public-method-label">{methodLabels[key] || key}</span>
                  <span className="public-method-value">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(isPending || submitted) && (
          <div className="public-banner public-banner-pending">
            <FiClock size={16} />
            <span>Your payment confirmation is pending verification by the organizer.</span>
          </div>
        )}

        {isRejected && (
          <div className="public-banner public-banner-rejected">
            <FiXCircle size={16} />
            <span>Payment was rejected. Please contact the organizer.</span>
          </div>
        )}

        {status !== 'paid' && !isPending && !submitted && (
          <button className="btn public-pay-btn" onClick={() => setModalOpen(true)}>
            <FiCheckCircle size={16} />
            Nimelipa, Mjulishe Mratibu
          </button>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Your Payment">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Amount Sent</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 10000"
              value={form.submitted_amount}
              onChange={e => setForm(f => ({ ...f, submitted_amount: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Reference Number (optional)</label>
            <input
              type="text"
              placeholder="Transaction reference"
              value={form.reference_number}
              onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Message (optional)</label>
            <textarea
              placeholder="Anything else the organizer should know?"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            />
          </div>
          {submitError && <p className="form-error">{submitError}</p>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Confirm'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
