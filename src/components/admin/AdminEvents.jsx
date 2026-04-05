import { useState, useEffect, useContext } from 'react';
import { ToastContext } from '../../context/ToastContext';
import { eventService } from '../../services/eventService';
import { userService } from '../../services/userService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getErrorMessage, truncate } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import './AdminEvents.css';

const EMPTY_FORM = { name: '', description: '', target_amount: '', organization_id: '' };

export default function AdminEvents() {
  const { toast } = useContext(ToastContext);
  const [events, setEvents] = useState([]);
  const [clientUsers, setClientUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, usersRes] = await Promise.all([
        eventService.getAll(),
        userService.getAll(),
      ]);
      setEvents(eventsRes.data.data || []);
      const allUsers = usersRes.data.data || [];
      setClientUsers(allUsers.filter(u => u.role === 'client_user'));
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
    if (!formData.name.trim()) errs.name = 'Event name is required';
    if (!formData.organization_id) errs.organization_id = 'Please select a client user';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await eventService.create({
        ...formData,
        target_amount: parseFloat(formData.target_amount) || 0,
      });
      toast.success('Event created and assigned');
      setShowModal(false);
      setFormData(EMPTY_FORM);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (event) => {
    setSelectedEvent(event);
    setShowConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await eventService.delete(selectedEvent.id);
      toast.success('Event deleted');
      setShowConfirm(false);
      setSelectedEvent(null);
      fetchData();
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
      <span className="error-icon">⚠️</span>
      <p>{error}</p>
      <button className="btn" onClick={fetchData}>Retry</button>
    </div>
  );

  return (
    <div className="admin-events">
      <div className="page-header">
        <div>
          <h2 className="page-title">Events</h2>
          <p className="page-subtitle">{events.length} event{events.length !== 1 ? 's' : ''} across all clients</p>
        </div>
        <button className="btn" onClick={() => { setFormData(EMPTY_FORM); setFormErrors({}); setShowModal(true); }}>
          + Create Event
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState icon="🎉" title="No events yet" description="Create an event and assign it to a client user." />
      ) : (
        <div className="section-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Description</th>
                  <th>Target</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td className="td-name">{ev.name}</td>
                    <td className="td-desc">{truncate(ev.description || '—', 60)}</td>
                    <td className="td-money">{formatCurrency(ev.target_amount)}</td>
                    <td>
                      <span className="owner-chip">
                        <span className="owner-avatar">{ev.owner_name?.[0]?.toUpperCase()}</span>
                        {ev.owner_name}
                      </span>
                    </td>
                    <td className="td-date">{formatDate(ev.created_at)}</td>
                    <td className="td-actions">
                      <button className="btn-sm btn-sm-danger" onClick={() => handleDeleteClick(ev)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create event modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create New Event" size="medium">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Event Name *</label>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Annual Fundraiser 2025" />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Optional description…" />
          </div>
          <div className="form-group">
            <label>Target Amount (TZS)</label>
            <input name="target_amount" type="number" min="0" step="0.01" value={formData.target_amount} onChange={handleChange} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label>Assign To (Client User) *</label>
            <select name="organization_id" value={formData.organization_id} onChange={handleChange}>
              <option value="">Select a client user…</option>
              {clientUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </select>
            {formErrors.organization_id && <span className="field-error">{formErrors.organization_id}</span>}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create Event'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setSelectedEvent(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message={`Delete "${selectedEvent?.name}"? All contributions and payments for this event will also be deleted.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
