import { useState, useEffect, useContext } from 'react';
import { FiPlus, FiUsers, FiAlertTriangle, FiEye, FiEyeOff, FiArchive } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import { userService } from '../../services/userService';
import { formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import { StatsSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import './UserManagement.css';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  client_user: 'Client User',
};

function buildEmptyForm() {
  return { name: '', email: '', password: '', role: 'client_user' };
}

export default function UserManagement() {
  const { user: currentUser } = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showModal,    setShowModal]    = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [confirmHide,  setConfirmHide]  = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData,     setFormData]     = useState(buildEmptyForm());
  const [formErrors,   setFormErrors]   = useState({});
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [hiding,       setHiding]       = useState(false);
  const [togglingId,   setTogglingId]   = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userService.getAll();
      setUsers(res.data.data || []);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
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
    if (!validateForm()) return;
    setSaving(true);
    try {
      await userService.create(formData);
      toast.success('User created successfully');
      setShowModal(false);
      setFormData(buildEmptyForm());
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user) => {
    setTogglingId(user.id);
    try {
      await userService.toggleStatus(user.id);
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await userService.delete(selectedUser.id);
      toast.success('User deleted');
      setShowConfirm(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleHideConfirm = async () => {
    setHiding(true);
    try {
      await userService.hide(confirmHide.id);
      toast.success(`"${confirmHide.name}" moved to hidden`);
      setConfirmHide(null);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setHiding(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const openModal = () => {
    setFormData(buildEmptyForm());
    setFormErrors({});
    setShowPassword(false);
    setShowModal(true);
  };

  if (loading) return <StatsSkeleton count={4} />;
  if (error) return (
    <div className="error-state">
      <FiAlertTriangle size={36} color="var(--accent-orange)" />
      <p>{error}</p>
      <button className="btn" onClick={fetchUsers}>Retry</button>
    </div>
  );

  return (
    <div className="user-management">
      <div className="page-header">
        <div>
          <h2 className="page-title">User Management</h2>
          <p className="page-subtitle">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button className="btn" onClick={openModal}>
          <FiPlus size={16} /> Add User
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState IconComponent={FiUsers} title="No users yet" description="Create the first client user." />
      ) : (
        <div className="section-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-name">{u.name}</td>
                    <td className="td-secondary">{u.email}</td>
                    <td>
                      <span className={`role-badge role-${u.role}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${u.is_active ? 'pill-active' : 'pill-inactive'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="td-date">{formatDate(u.created_at)}</td>
                    <td className="td-actions">
                      <button
                        className={`btn-sm ${u.is_active ? 'btn-sm-warning' : 'btn-sm-success'}`}
                        onClick={() => handleToggleStatus(u)}
                        disabled={togglingId === u.id}
                      >
                        {togglingId === u.id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn-sm btn-sm-orange"
                        onClick={() => setConfirmHide(u)}
                        title="Move to hidden (recoverable for 30 days)"
                      >
                        <FiArchive size={12} /> Hide
                      </button>
                      <button
                        className="btn-sm btn-sm-danger"
                        onClick={() => { setSelectedUser(u); setShowConfirm(true); }}
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

      {/* ── Create user modal ──────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New User" size="small">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Full Name *</label>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>
          <div className="form-group">
            <label>Email Address *</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" />
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
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="client_user">Client User</option>
              {isSuperAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Hide confirm ───────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmHide}
        onClose={() => setConfirmHide(null)}
        onConfirm={handleHideConfirm}
        title="Hide User"
        message={`Hide "${confirmHide?.name}"? Their account and contributions will be hidden. You can restore them from Hidden Records within 30 days.`}
        confirmText="Hide User"
        confirmVariant="warning"
        loading={hiding}
      />

      {/* ── Delete confirm ─────────────────────────────── */}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setSelectedUser(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={`Delete "${selectedUser?.name}"? This cascades to all their events, contributions, and payments.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
