import { useState, useEffect, useContext } from 'react';
import { FiPlus, FiShield, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';
import { StatsSkeleton } from '../common/SkeletonLoader';
import './AdminManagement.css';

const EMPTY_FORM = { name: '', email: '', password: '' };

export default function AdminManagement() {
  const { toast } = useContext(ToastContext);

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { fetchAdmins(); }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin');
      setAdmins(res.data.data || []);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim())     errs.name     = 'Name is required';
    if (!formData.email.trim())    errs.email    = 'Email is required';
    if (!formData.password.trim()) errs.password = 'Password is required';
    if (formData.password.length > 0 && formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/admin', formData);
      toast.success('Admin account created');
      setShowModal(false);
      setFormData(EMPTY_FORM);
      fetchAdmins();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (admin) => {
    setTogglingId(admin.id);
    try {
      await api.put(`/admin/${admin.id}/toggle-status`);
      toast.success(`Admin ${admin.is_active ? 'deactivated' : 'activated'}`);
      fetchAdmins();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/${selected.id}`);
      toast.success('Admin deleted');
      setShowConfirm(false);
      setSelected(null);
      fetchAdmins();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const openModal = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setShowPassword(false);
    setShowModal(true);
  };

  if (loading) return <StatsSkeleton count={4} />;
  if (error) return (
    <div className="error-state">
      <FiAlertTriangle size={36} color="var(--accent-orange)" />
      <p>{error}</p>
      <button className="btn" onClick={fetchAdmins}>Retry</button>
    </div>
  );

  return (
    <div className="admin-management">
      <div className="page-header">
        <div>
          <h2 className="page-title">Admin Accounts</h2>
          <p className="page-subtitle">
            {admins.length} admin{admins.length !== 1 ? 's' : ''} under your organization
          </p>
        </div>
        <button className="btn" onClick={openModal}>
          <FiPlus size={16} /> Create Admin
        </button>
      </div>

      {admins.length === 0 ? (
        <EmptyState
          IconComponent={FiShield}
          title="No admins yet"
          description="Create admin accounts to delegate management of events and contributors."
        />
      ) : (
        <div className="section-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id}>
                    <td className="td-name">
                      <span className="admin-name-wrap">
                        <FiShield size={13} className="admin-shield-icon" />
                        {a.name}
                      </span>
                    </td>
                    <td className="td-secondary">{a.email}</td>
                    <td>
                      <span className={`status-pill ${a.is_active ? 'pill-active' : 'pill-inactive'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="td-date">{formatDate(a.created_at)}</td>
                    <td className="td-actions">
                      <button
                        className={`btn-sm ${a.is_active ? 'btn-sm-warning' : 'btn-sm-success'}`}
                        onClick={() => handleToggle(a)}
                        disabled={togglingId === a.id}
                      >
                        {togglingId === a.id ? '…' : a.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn-sm btn-sm-danger"
                        onClick={() => { setSelected(a); setShowConfirm(true); }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create admin modal ─────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Admin Account" size="small">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Full Name *</label>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Admin name" />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>
          <div className="form-group">
            <label>Email Address *</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="admin@example.com" />
            {formErrors.email && <span className="field-error">{formErrors.email}</span>}
          </div>
          <div className="form-group">
            <label>Password *</label>
            <div className="input-wrapper">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {formErrors.password && <span className="field-error">{formErrors.password}</span>}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Creating…' : 'Create Admin'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setSelected(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Admin"
        message={`Delete admin "${selected?.name}"? Their events, contributors, and contributions will be removed.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
