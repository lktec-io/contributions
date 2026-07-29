import { useState, useEffect, useCallback, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiCopy, FiDownload } from 'react-icons/fi';
import { ToastContext } from '../context/ToastContext';
import { publicService } from '../services/publicService';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { copyToClipboard } from '../utils/clipboard';
import { playSuccessSound } from '../utils/sound';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SuccessToast from '../components/common/SuccessToast';
import './PublicContribution.css';

const REQUEST_STATUS_BADGE = {
  pending:  { className: 'status-badge badge-pledge',   label: 'Pending' },
  approved: { className: 'status-badge badge-paid',     label: 'Approved' },
  rejected: { className: 'status-badge badge-rejected', label: 'Rejected' },
};

export default function PublicContribution() {
  const { token } = useParams();
  const { toast } = useContext(ToastContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
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

  const handleCopy = async (value) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      await publicService.downloadReceipt(token);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not download the receipt. Please try again.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await publicService.submitPaymentRequest(token, form);
      setModalOpen(false);
      setForm({ submitted_amount: '', reference_number: '', message: '' });
      playSuccessSound();
      setShowSubmitted(true);
      setTimeout(() => setShowSubmitted(false), 3000);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.');
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
    organization_name, logo_url,
  } = data;

  const mobileMethods = payment_methods?.mobile || [];
  const bankMethods    = payment_methods?.bank   || [];
  const hasPaymentMethods = mobileMethods.length > 0 || bankMethods.length > 0;

  const requestBadge = latest_request ? REQUEST_STATUS_BADGE[latest_request.status] : null;
  const isPending  = latest_request?.status === 'pending';
  const isRejected = latest_request?.status === 'rejected';
  const isApproved = latest_request?.status === 'approved';

  return (
    <div className="public-page">
      <SuccessToast message="Copied" show={showCopied} />
      <SuccessToast
        show={showSubmitted}
        title="Payment request sent successfully."
        message="The organizer will verify your payment shortly."
      />

      <div className="public-card">
        {(logo_url || organization_name) && (
          <div className="public-branding">
            {logo_url && <img src={logo_url} alt="" className="public-branding-logo" />}
            <span className="public-branding-name">{organization_name}</span>
          </div>
        )}

        <div className="public-card-header">
          <span className="public-event-name">{event_name}</span>
          <div className="public-badge-group">
            <span className={`status-badge ${status}`}>{status}</span>
            {requestBadge && <span className={requestBadge.className}>{requestBadge.label}</span>}
          </div>
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
            <div className="public-methods-list">
              {mobileMethods.map((m, i) => (
                <div key={`mobile-${i}`} className="public-method-card">
                  <span className="public-method-network">{m.network}</span>
                  <div className="public-method-row">
                    <span className="public-method-key">Name</span>
                    <span className="public-method-val">{m.account_name}</span>
                  </div>
                  <div className="public-method-row">
                    <span className="public-method-key">Number</span>
                    <span className="public-method-val public-method-val-copy">
                      {m.phone}
                      <button type="button" className="public-copy-btn" onClick={() => handleCopy(m.phone)} aria-label="Copy phone number">
                        <FiCopy size={14} />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
              {bankMethods.map((b, i) => (
                <div key={`bank-${i}`} className="public-method-card">
                  <span className="public-method-network">{b.bank_name}</span>
                  <div className="public-method-row">
                    <span className="public-method-key">Account Name</span>
                    <span className="public-method-val">{b.account_name}</span>
                  </div>
                  <div className="public-method-row">
                    <span className="public-method-key">Account Number</span>
                    <span className="public-method-val public-method-val-copy">
                      {b.account_number}
                      <button type="button" className="public-copy-btn" onClick={() => handleCopy(b.account_number)} aria-label="Copy account number">
                        <FiCopy size={14} />
                      </button>
                    </span>
                  </div>
                  {b.branch && (
                    <div className="public-method-row">
                      <span className="public-method-key">Branch</span>
                      <span className="public-method-val">{b.branch}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isRejected && (
          <div className="public-banner public-banner-rejected">
            <FiXCircle size={16} />
            <span>Payment was rejected. Please contact the organizer.</span>
          </div>
        )}

        {isApproved && (
          <button
            className="btn-secondary public-receipt-btn"
            onClick={handleDownloadReceipt}
            disabled={downloadingReceipt}
          >
            <FiDownload size={16} />
            {downloadingReceipt ? 'Preparing...' : 'Download Receipt'}
          </button>
        )}

        {status !== 'paid' && (
          isPending ? (
            <button className="btn public-pay-btn public-pay-btn-submitted" disabled>
              <FiCheckCircle size={16} />
              Request Submitted
            </button>
          ) : (
            <button className="btn public-pay-btn" onClick={() => setModalOpen(true)}>
              <FiCheckCircle size={16} />
              Nimelipa, Mjulishe Mratibu
            </button>
          )
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
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Confirm'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
