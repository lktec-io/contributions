import { useState, useEffect, useContext, useCallback } from 'react';
import { FiArchive, FiRefreshCw, FiTrash2, FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ToastContext } from '../context/ToastContext';
import { contributionService } from '../services/contributionService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getErrorMessage } from '../utils/helpers';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import './HiddenRecords.css';

export default function HiddenRecords() {
  const { toast }    = useContext(ToastContext);
  const navigate     = useNavigate();

  const [contributions, setContributions] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const [actionLoading,  setActionLoading]  = useState(false);

  const fetchHidden = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await contributionService.getHidden();
      const data = res.data.data;
      setContributions(data.contributions || data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHidden(); }, [fetchHidden]);

  const handleRestore = async () => {
    setActionLoading(true);
    try {
      await contributionService.restore(confirmRestore.id);
      toast.success(`"${confirmRestore.contributor_name}" restored`);
      setConfirmRestore(null);
      fetchHidden();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    setActionLoading(true);
    try {
      await contributionService.permanentDelete(confirmDelete.id);
      toast.success(`"${confirmDelete.contributor_name}" permanently deleted`);
      setConfirmDelete(null);
      fetchHidden();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="hidden-records">

      <div className="hr-header">
        <button className="hr-back-btn" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
          <FiArrowLeft size={16} />
        </button>
        <div className="hr-header-text">
          <h2 className="hr-title">
            <FiArchive size={20} className="hr-title-icon" />
            Hidden Records
          </h2>
          <p className="hr-subtitle">
            {contributions.length} hidden contributor{contributions.length !== 1 ? 's' : ''} — auto-deleted after 30 days
          </p>
        </div>
        <button className="hr-refresh-btn" onClick={fetchHidden} title="Refresh" disabled={loading}>
          <FiRefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="hr-loading"><LoadingSpinner size="large" /></div>
      ) : error ? (
        <div className="hr-error">
          <FiAlertTriangle size={32} color="var(--accent-orange)" />
          <p>{error}</p>
          <button className="btn" onClick={fetchHidden}>Retry</button>
        </div>
      ) : contributions.length === 0 ? (
        <EmptyState
          IconComponent={FiArchive}
          title="No hidden records"
          description="Contributors that are hidden will appear here."
        />
      ) : (
        <div className="section-card">
          <div className="hr-table-wrap">
            <table className="data-table hr-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Event</th>
                  <th>Pledged</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Hidden On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map(c => (
                  <tr key={c.id} className="hr-row">
                    <td className="td-name">{c.contributor_name}</td>
                    <td>{c.event_name || '—'}</td>
                    <td className="td-money">{formatCurrency(c.amount)}</td>
                    <td className="td-money td-paid">{formatCurrency(c.paid_amount)}</td>
                    <td><span className={`status-badge ${c.status}`}>{c.status}</span></td>
                    <td className="td-date">{c.hidden_at ? formatDate(c.hidden_at) : '—'}</td>
                    <td className="td-actions">
                      <button
                        className="icon-btn icon-btn-green"
                        onClick={() => setConfirmRestore(c)}
                        title="Restore contributor"
                      >
                        <FiRefreshCw size={15} />
                      </button>
                      <button
                        className="icon-btn icon-btn-red"
                        onClick={() => setConfirmDelete(c)}
                        title="Delete permanently"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        onConfirm={handleRestore}
        title="Restore Contributor"
        message={`Restore "${confirmRestore?.contributor_name}"? They will become visible again in the active contributions list.`}
        confirmText="Restore"
        confirmVariant="success"
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete"
        message={`Permanently delete "${confirmDelete?.contributor_name}"? This cannot be undone and all payment history will be removed.`}
        confirmText="Delete Permanently"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
