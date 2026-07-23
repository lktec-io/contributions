import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw, FiCheck, FiX, FiAlertTriangle, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
import { ToastContext } from '../context/ToastContext';
import { paymentRequestService } from '../services/paymentRequestService';
import { formatCurrency, formatDateTime, getStatusBadgeClass } from '../utils/formatters';
import { getErrorMessage } from '../utils/helpers';
import { playSuccessSound, playWarningSound } from '../utils/sound';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import SuccessToast from '../components/common/SuccessToast';
import './PaymentRequests.css';

export default function PaymentRequests() {
  const { toast } = useContext(ToastContext);
  const navigate   = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [confirmApprove, setConfirmApprove] = useState(null);
  const [confirmReject, setConfirmReject]   = useState(null);
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [actionLoading, setActionLoading]   = useState(false);

  const [resultPopup, setResultPopup]         = useState({ variant: 'success', title: '', message: '' });
  const [showResultPopup, setShowResultPopup] = useState(false);

  const flashResultPopup = (variant, title, message) => {
    setResultPopup({ variant, title, message });
    setShowResultPopup(true);
    setTimeout(() => setShowResultPopup(false), 3000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentRequestService.getAll();
      setRequests(res.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await paymentRequestService.approve(confirmApprove.id);
      playSuccessSound();
      flashResultPopup(
        'success',
        'Payment Approved Successfully',
        `${confirmApprove.contributor_name} — ${confirmApprove.event_name}\n${formatCurrency(confirmApprove.submitted_amount)} Approved`
      );
      setConfirmApprove(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await paymentRequestService.reject(confirmReject.id);
      playWarningSound();
      flashResultPopup(
        'warning',
        'Payment Request Rejected',
        `${confirmReject.contributor_name} — ${confirmReject.event_name}`
      );
      setConfirmReject(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await paymentRequestService.remove(confirmDelete.id);
      toast.success(`Request from "${confirmDelete.contributor_name}" deleted`);
      setConfirmDelete(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="payment-requests">
      <SuccessToast
        show={showResultPopup}
        variant={resultPopup.variant}
        title={resultPopup.title}
        message={resultPopup.message}
        icon={resultPopup.variant === 'warning' ? FiAlertTriangle : undefined}
      />

      <div className="pr-header">
        <button className="pr-back-btn" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
          <FiArrowLeft size={16} />
        </button>
        <div className="pr-header-text">
          <h2 className="pr-title">
            <FiCheckCircle size={20} className="pr-title-icon" />
            Payment Requests
          </h2>
          <p className="pr-subtitle">
            {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting verification
          </p>
        </div>
        <button className="pr-refresh-btn" onClick={fetchAll} title="Refresh" disabled={loading}>
          <FiRefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="pr-loading"><LoadingSpinner size="large" /></div>
      ) : error ? (
        <div className="pr-error">
          <FiAlertTriangle size={32} color="var(--accent-orange)" />
          <p>{error}</p>
          <button className="btn" onClick={fetchAll}>Retry</button>
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          IconComponent={FiCheckCircle}
          title="No payment requests"
          description="Requests submitted by contributors from their public contribution link will appear here."
        />
      ) : (
        <div className="section-card">
          {/* Desktop table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contributor</th>
                  <th>Event</th>
                  <th>Amount Submitted</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td className="td-name">{r.contributor_name}</td>
                    <td>{r.event_name}</td>
                    <td className="td-money">{formatCurrency(r.submitted_amount)}</td>
                    <td>{r.reference_number || '—'}</td>
                    <td className="td-date">{formatDateTime(r.submitted_at)}</td>
                    <td><span className={getStatusBadgeClass(r.status === 'pending' ? 'pledge' : r.status === 'approved' ? 'paid' : 'partial')}>{r.status}</span></td>
                    <td className="td-actions">
                      {r.status === 'pending' ? (
                        <>
                          <button className="icon-btn icon-btn-green" title="Approve" onClick={() => setConfirmApprove(r)}>
                            <FiCheck size={15} />
                          </button>
                          <button className="icon-btn icon-btn-red" title="Reject" onClick={() => setConfirmReject(r)}>
                            <FiX size={15} />
                          </button>
                        </>
                      ) : r.status === 'rejected' ? (
                        <button className="icon-btn icon-btn-red" title="Delete" onClick={() => setConfirmDelete(r)}>
                          <FiTrash2 size={15} />
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="pr-card-list">
            {requests.map(r => (
              <div key={r.id} className="pr-card">
                <div className="pr-card-row pr-card-top">
                  <span className="pr-card-name">{r.contributor_name}</span>
                  <span className={getStatusBadgeClass(r.status === 'pending' ? 'pledge' : r.status === 'approved' ? 'paid' : 'partial')}>{r.status}</span>
                </div>
                <div className="pr-card-row">
                  <span className="pr-card-label">Event</span>
                  <span className="pr-card-value">{r.event_name}</span>
                </div>
                <div className="pr-card-row">
                  <span className="pr-card-label">Amount</span>
                  <span className="pr-card-value">{formatCurrency(r.submitted_amount)}</span>
                </div>
                <div className="pr-card-row">
                  <span className="pr-card-label">Reference</span>
                  <span className="pr-card-value">{r.reference_number || '—'}</span>
                </div>
                <div className="pr-card-row">
                  <span className="pr-card-label">Date</span>
                  <span className="pr-card-value">{formatDateTime(r.submitted_at)}</span>
                </div>
                {r.status === 'pending' && (
                  <div className="pr-card-actions">
                    <button className="pr-action-btn pr-action-approve" onClick={() => setConfirmApprove(r)}>
                      <FiCheck size={14} /> Approve
                    </button>
                    <button className="pr-action-btn pr-action-reject" onClick={() => setConfirmReject(r)}>
                      <FiX size={14} /> Reject
                    </button>
                  </div>
                )}
                {r.status === 'rejected' && (
                  <div className="pr-card-actions">
                    <button className="pr-action-btn pr-action-reject" onClick={() => setConfirmDelete(r)}>
                      <FiTrash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmApprove}
        onClose={() => setConfirmApprove(null)}
        onConfirm={handleApprove}
        title="Approve Payment Request"
        message={`Record a payment of ${confirmApprove ? formatCurrency(confirmApprove.submitted_amount) : ''} for "${confirmApprove?.contributor_name}"? This will update their balance immediately.`}
        confirmText="Approve"
        confirmVariant="success"
        loading={actionLoading}
      />
      <ConfirmDialog
        isOpen={!!confirmReject}
        onClose={() => setConfirmReject(null)}
        onConfirm={handleReject}
        title="Reject Payment Request"
        message={`Reject this payment request from "${confirmReject?.contributor_name}"? They will be notified to contact you.`}
        confirmText="Reject"
        confirmVariant="danger"
        loading={actionLoading}
      />
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Payment Request"
        message={`Permanently delete this rejected request from "${confirmDelete?.contributor_name}"? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
