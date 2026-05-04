import { useState, useEffect, useContext, useCallback } from 'react';
import {
  FiArchive, FiRefreshCw, FiTrash2, FiArrowLeft, FiAlertTriangle,
  FiUsers, FiGrid,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ToastContext } from '../context/ToastContext';
import { contributionService } from '../services/contributionService';
import { userService } from '../services/userService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getErrorMessage } from '../utils/helpers';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import './HiddenRecords.css';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  client_user: 'Client User',
};

export default function HiddenRecords() {
  const { toast } = useContext(ToastContext);
  const navigate  = useNavigate();

  const [activeTab,     setActiveTab]     = useState('contributions');
  const [contributions, setContributions] = useState([]);
  const [hiddenUsers,   setHiddenUsers]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  // Contribution dialogs
  const [confirmRestoreContrib, setConfirmRestoreContrib] = useState(null);
  const [confirmDeleteContrib,  setConfirmDeleteContrib]  = useState(null);

  // User dialogs
  const [confirmRestoreUser, setConfirmRestoreUser] = useState(null);
  const [confirmDeleteUser,  setConfirmDeleteUser]  = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contribRes, usersRes] = await Promise.all([
        contributionService.getHidden(),
        userService.getHidden(),
      ]);
      const cData = contribRes.data.data;
      setContributions(cData.contributions || cData || []);
      setHiddenUsers(usersRes.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Contribution actions ────────────────────────────────────
  const handleRestoreContrib = async () => {
    setActionLoading(true);
    try {
      await contributionService.restore(confirmRestoreContrib.id);
      toast.success(`"${confirmRestoreContrib.contributor_name}" restored`);
      setConfirmRestoreContrib(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteContrib = async () => {
    setActionLoading(true);
    try {
      await contributionService.permanentDelete(confirmDeleteContrib.id);
      toast.success(`"${confirmDeleteContrib.contributor_name}" permanently deleted`);
      setConfirmDeleteContrib(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ── User actions ────────────────────────────────────────────
  const handleRestoreUser = async () => {
    setActionLoading(true);
    try {
      await userService.restore(confirmRestoreUser.id);
      toast.success(`"${confirmRestoreUser.name}" restored`);
      setConfirmRestoreUser(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setActionLoading(true);
    try {
      await userService.permanentDelete(confirmDeleteUser.id);
      toast.success(`"${confirmDeleteUser.name}" permanently deleted`);
      setConfirmDeleteUser(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const totalHidden = contributions.length + hiddenUsers.length;

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
            {totalHidden} hidden record{totalHidden !== 1 ? 's' : ''} — auto-deleted after 30 days
          </p>
        </div>
        <button className="hr-refresh-btn" onClick={fetchAll} title="Refresh" disabled={loading}>
          <FiRefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="hr-tabs">
        <button
          className={`hr-tab ${activeTab === 'contributions' ? 'hr-tab-active' : ''}`}
          onClick={() => setActiveTab('contributions')}
        >
          <FiGrid size={14} />
          Contributors
          {contributions.length > 0 && (
            <span className="hr-tab-count">{contributions.length}</span>
          )}
        </button>
        <button
          className={`hr-tab ${activeTab === 'users' ? 'hr-tab-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <FiUsers size={14} />
          Users
          {hiddenUsers.length > 0 && (
            <span className="hr-tab-count">{hiddenUsers.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="hr-loading"><LoadingSpinner size="large" /></div>
      ) : error ? (
        <div className="hr-error">
          <FiAlertTriangle size={32} color="var(--accent-orange)" />
          <p>{error}</p>
          <button className="btn" onClick={fetchAll}>Retry</button>
        </div>
      ) : activeTab === 'contributions' ? (

        // ── Contributors tab ──────────────────────────────
        contributions.length === 0 ? (
          <EmptyState
            IconComponent={FiArchive}
            title="No hidden contributors"
            description="Contributors that are hidden will appear here."
          />
        ) : (
          <div className="section-card">
            {/* Desktop table */}
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
                          onClick={() => setConfirmRestoreContrib(c)}
                          title="Restore contributor"
                        >
                          <FiRefreshCw size={15} />
                        </button>
                        <button
                          className="icon-btn icon-btn-red"
                          onClick={() => setConfirmDeleteContrib(c)}
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

            {/* Mobile cards */}
            <div className="hidden-container">
              {contributions.map(c => (
                <div key={c.id} className="hidden-card">
                  <div className="hidden-card-header">
                    <span className="hidden-card-name">{c.contributor_name}</span>
                    <span className={`status-badge ${c.status}`}>{c.status}</span>
                  </div>
                  <div className="hidden-card-row">
                    <span className="hidden-card-label">Event</span>
                    <span className="hidden-card-value">{c.event_name || '—'}</span>
                  </div>
                  <div className="hidden-card-row">
                    <span className="hidden-card-label">Pledged</span>
                    <span className="hidden-card-value">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="hidden-card-row">
                    <span className="hidden-card-label">Paid</span>
                    <span className="hidden-card-value td-paid">{formatCurrency(c.paid_amount)}</span>
                  </div>
                  <div className="hidden-card-row">
                    <span className="hidden-card-label">Hidden On</span>
                    <span className="hidden-card-value">{c.hidden_at ? formatDate(c.hidden_at) : '—'}</span>
                  </div>
                  <div className="hidden-actions">
                    <button
                      className="hidden-action-btn hidden-action-restore"
                      onClick={() => setConfirmRestoreContrib(c)}
                    >
                      <FiRefreshCw size={14} /> Restore
                    </button>
                    <button
                      className="hidden-action-btn hidden-action-delete"
                      onClick={() => setConfirmDeleteContrib(c)}
                    >
                      <FiTrash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      ) : (

        // ── Users tab ─────────────────────────────────────
        hiddenUsers.length === 0 ? (
          <EmptyState
            IconComponent={FiUsers}
            title="No hidden users"
            description="Users that are hidden will appear here."
          />
        ) : (
          <div className="section-card">
            {/* Desktop table */}
            <div className="hr-table-wrap">
              <table className="data-table hr-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Hidden On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hiddenUsers.map(u => (
                    <tr key={u.id} className="hr-row">
                      <td className="td-name">{u.name}</td>
                      <td className="td-secondary">{u.email}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="td-date">{u.hidden_at ? formatDate(u.hidden_at) : '—'}</td>
                      <td className="td-actions">
                        <button
                          className="icon-btn icon-btn-green"
                          onClick={() => setConfirmRestoreUser(u)}
                          title="Restore user"
                        >
                          <FiRefreshCw size={15} />
                        </button>
                        <button
                          className="icon-btn icon-btn-red"
                          onClick={() => setConfirmDeleteUser(u)}
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

            {/* Mobile cards */}
            <div className="hidden-container">
              {hiddenUsers.map(u => (
                <div key={u.id} className="hidden-card">
                  <div className="hidden-card-header">
                    <span className="hidden-card-name">{u.name}</span>
                    <span className={`role-badge role-${u.role}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                  <div className="hidden-card-row">
                    <span className="hidden-card-label">Email</span>
                    <span className="hidden-card-value">{u.email}</span>
                  </div>
                  <div className="hidden-card-row">
                    <span className="hidden-card-label">Hidden On</span>
                    <span className="hidden-card-value">{u.hidden_at ? formatDate(u.hidden_at) : '—'}</span>
                  </div>
                  <div className="hidden-actions">
                    <button
                      className="hidden-action-btn hidden-action-restore"
                      onClick={() => setConfirmRestoreUser(u)}
                    >
                      <FiRefreshCw size={14} /> Restore
                    </button>
                    <button
                      className="hidden-action-btn hidden-action-delete"
                      onClick={() => setConfirmDeleteUser(u)}
                    >
                      <FiTrash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Contribution dialogs ───────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmRestoreContrib}
        onClose={() => setConfirmRestoreContrib(null)}
        onConfirm={handleRestoreContrib}
        title="Restore Contributor"
        message={`Restore "${confirmRestoreContrib?.contributor_name}"? They will become visible again in the active contributions list.`}
        confirmText="Restore"
        confirmVariant="success"
        loading={actionLoading}
      />
      <ConfirmDialog
        isOpen={!!confirmDeleteContrib}
        onClose={() => setConfirmDeleteContrib(null)}
        onConfirm={handleDeleteContrib}
        title="Permanently Delete Contributor"
        message={`Permanently delete "${confirmDeleteContrib?.contributor_name}"? This cannot be undone and all payment history will be removed.`}
        confirmText="Delete Permanently"
        confirmVariant="danger"
        loading={actionLoading}
      />

      {/* ── User dialogs ───────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmRestoreUser}
        onClose={() => setConfirmRestoreUser(null)}
        onConfirm={handleRestoreUser}
        title="Restore User"
        message={`Restore "${confirmRestoreUser?.name}"? Their account and contributions will become active again.`}
        confirmText="Restore"
        confirmVariant="success"
        loading={actionLoading}
      />
      <ConfirmDialog
        isOpen={!!confirmDeleteUser}
        onClose={() => setConfirmDeleteUser(null)}
        onConfirm={handleDeleteUser}
        title="Permanently Delete User"
        message={`Permanently delete "${confirmDeleteUser?.name}"? This will remove their account and all associated data. This cannot be undone.`}
        confirmText="Delete Permanently"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
