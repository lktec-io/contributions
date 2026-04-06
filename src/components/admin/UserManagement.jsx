import { useState, useEffect, useContext } from 'react';
import { FiPlus, FiUsers, FiAlertTriangle } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { userService } from '../../services/userService';
import { formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import './UserManagement.css';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'client_user' };

export default function UserManagement() {
  const { toast } = useContext(ToastContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

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
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!formData.password.trim()) errs.password = 'Password is required';
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
      setFormData(EMPTY_FORM);
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

  const handleDeleteClick = (user) => { setSelectedUser(user); setShowConfirm(true); };

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  if (loading) return <div className="tab-loading"><LoadingSpinner size="large" /></div>;
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
        <button className="btn" onClick={() => { setFormData(EMPTY_FORM); setFormErrors({}); setShowModal(true); }}>
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
                    <td className="td-email">{u.email}</td>
                    <td>
                      <span className={`role-badge role-${u.role}`}>
                        {u.role === 'super_admin' ? 'Admin' : 'Client'}
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
                      <button className="btn-sm btn-sm-danger" onClick={() => handleDeleteClick(u)}>
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
            <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Min. 8 characters" autoComplete="new-password" />
            {formErrors.password && <span className="field-error">{formErrors.password}</span>}
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="client_user">Client User</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setSelectedUser(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={`Are you sure you want to delete "${selectedUser?.name}"? This will cascade delete all their events, contributions, and payments.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
