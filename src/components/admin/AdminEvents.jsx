import { useState, useEffect, useContext, useMemo } from 'react';
import { FiPlus, FiCalendar, FiAlertTriangle, FiEdit2, FiTrash2, FiUsers, FiUser, FiSearch, FiX } from 'react-icons/fi';
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

const EMPTY_FORM = { name: '', description: '' };

function buildAssignPayload(selectedUsers) {
  return selectedUsers.map(u => ({
    user_id:       u.id,
    target_amount: parseFloat(u.target_amount) || 0,
  }));
}

// ── User assignment sub-form ────────────────────────────────
function AssignmentForm({ clientUsers, selectedUsers, setSelectedUsers, mode, setMode }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    clientUsers.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ),
  [clientUsers, search]);

  const isSelected = (id) => selectedUsers.some(u => u.id === id);

  const toggleUser = (user) => {
    if (isSelected(user.id)) {
      setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers(prev => [...prev, { ...user, target_amount: '' }]);
    }
  };

  const setAmount = (userId, value) => {
    setSelectedUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, target_amount: value } : u)
    );
  };

  const removeUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'all') {
      setSelectedUsers(clientUsers.map(u => ({ ...u, target_amount: '' })));
    } else {
      setSelectedUsers([]);
    }
  };

  return (
    <div className="ae-assign-wrap">
      {/* Mode tabs */}
      <div className="ae-mode-tabs">
        <button
          type="button"
          className={`ae-mode-tab ${mode === 'specific' ? 'active' : ''}`}
          onClick={() => handleModeChange('specific')}
        >
          <FiUser size={13} /> Select Specific
        </button>
        <button
          type="button"
          className={`ae-mode-tab ${mode === 'all' ? 'active' : ''}`}
          onClick={() => handleModeChange('all')}
        >
          <FiUsers size={13} /> All Users ({clientUsers.length})
        </button>
      </div>

      {/* User picker — only in specific mode */}
      {mode === 'specific' && (
        <div className="ae-user-picker">
          <div className="ae-search-wrap">
            <FiSearch size={14} className="ae-search-icon" />
            <input
              type="text"
              className="ae-search-input"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="ae-user-list">
            {filtered.length === 0 ? (
              <p className="ae-no-users">No users found</p>
            ) : (
              filtered.map(u => (
                <label key={u.id} className={`ae-user-row ${isSelected(u.id) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected(u.id)}
                    onChange={() => toggleUser(u)}
                  />
                  <span className="ae-user-avatar">{u.name?.[0]?.toUpperCase()}</span>
                  <span className="ae-user-info">
                    <span className="ae-user-name">{u.name}</span>
                    <span className="ae-user-email">{u.email}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Per-user amount inputs */}
      {selectedUsers.length > 0 && (
        <div className="ae-amounts">
          <p className="ae-amounts-label">
            Target amount per user ({selectedUsers.length} selected)
          </p>
          <div className="ae-amounts-list">
            {selectedUsers.map(u => (
              <div key={u.id} className="ae-amount-row">
                <span className="ae-amount-avatar">{u.name?.[0]?.toUpperCase()}</span>
                <span className="ae-amount-name">{u.name}</span>
                <div className="ae-amount-input-wrap">
                  <span className="ae-amount-prefix">TZS</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="ae-amount-input"
                    placeholder="0"
                    value={u.target_amount}
                    onChange={e => setAmount(u.id, e.target.value)}
                  />
                </div>
                {mode === 'specific' && (
                  <button
                    type="button"
                    className="ae-amount-remove"
                    onClick={() => removeUser(u.id)}
                    title="Remove"
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedUsers.length === 0 && mode === 'specific' && clientUsers.length > 0 && (
        <p className="ae-hint">Select at least one user above.</p>
      )}
      {clientUsers.length === 0 && (
        <p className="ae-hint">No active client users available. Create users first.</p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────
export default function AdminEvents() {
  const { toast } = useContext(ToastContext);
  const [events, setEvents] = useState([]);
  const [clientUsers, setClientUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createMode, setCreateMode] = useState('specific');
  const [createUsers, setCreateUsers] = useState([]);
  const [createErrors, setCreateErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editMode, setEditMode] = useState('specific');
  const [editUsers, setEditUsers] = useState([]);
  const [editErrors, setEditErrors] = useState({});
  const [updating, setUpdating] = useState(false);

  // Delete
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, usersRes] = await Promise.all([
        eventService.getAll(),
        userService.getAll(),
      ]);
      setEvents(eventsRes.data.data || []);
      const all = usersRes.data.data || [];
      setClientUsers(all.filter(u => u.role === 'client_user'));
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Create handlers ─────────────────────────────────────
  const openCreate = () => {
    setCreateForm(EMPTY_FORM);
    setCreateMode('specific');
    setCreateUsers([]);
    setCreateErrors({});
    setShowCreate(true);
  };

  const validateForm = (form, selectedUsers) => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Event name is required';
    if (!selectedUsers.length) errs.assignments = 'Assign to at least one user';
    else {
      const invalid = selectedUsers.some(u => {
        const v = parseFloat(u.target_amount);
        return isNaN(v) || v < 0 || u.target_amount === '';
      });
      if (invalid) errs.assignments = 'All target amounts must be valid numbers';
    }
    return errs;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = validateForm(createForm, createUsers);
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }
    setSaving(true);
    try {
      await eventService.create({
        name:        createForm.name.trim(),
        description: createForm.description,
        assignments: buildAssignPayload(createUsers),
      });
      toast.success('Event created and assigned');
      setShowCreate(false);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Edit handlers ────────────────────────────────────────
  const openEdit = (ev) => {
    setEditingEvent(ev);
    setEditForm({ name: ev.name, description: ev.description || '' });
    const existing = (ev.assignments || []).map(a => ({
      id:            a.user_id,
      name:          a.user_name,
      email:         a.user_email,
      target_amount: String(a.target_amount),
    }));
    setEditUsers(existing);
    setEditMode(existing.length === clientUsers.length ? 'all' : 'specific');
    setEditErrors({});
    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const errs = validateForm(editForm, editUsers);
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    setUpdating(true);
    try {
      await eventService.update(editingEvent.id, {
        name:        editForm.name.trim(),
        description: editForm.description,
        assignments: buildAssignPayload(editUsers),
      });
      toast.success('Event updated');
      setShowEdit(false);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  // ── Delete handlers ──────────────────────────────────────
  const handleDeleteClick = (ev) => { setSelectedEvent(ev); setShowConfirm(true); };

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

  if (loading) return <div className="tab-loading"><LoadingSpinner size="large" /></div>;
  if (error)   return (
    <div className="error-state">
      <FiAlertTriangle size={36} color="var(--accent-orange)" />
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
        <button className="btn" onClick={openCreate}>
          <FiPlus size={16} /> Create Event
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState IconComponent={FiCalendar} title="No events yet" description="Create an event and assign it to client users." />
      ) : (
        <div className="section-card">
          {/* ── Desktop / tablet: scrollable table ── */}
          <div className="table-wrap ae-events-table-wrap">
            <table className="data-table ae-events-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th className="th-desc">Description</th>
                  <th>Total Target</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => {
                  const asgns = ev.assignments || [];
                  return (
                    <tr key={ev.id}>
                      <td className="td-name ae-td-name">{ev.name}</td>
                      <td className="td-desc">{truncate(ev.description || '—', 60)}</td>
                      <td className="td-money">{formatCurrency(ev.target_amount)}</td>
                      <td className="ae-td-assigned">
                        <div className="assignment-chips">
                          {asgns.slice(0, 2).map(a => (
                            <span key={a.user_id} className="owner-chip" title={`${a.user_name} — TZS ${parseFloat(a.target_amount).toLocaleString()}`}>
                              <span className="owner-avatar">{a.user_name?.[0]?.toUpperCase()}</span>
                              {a.user_name}
                            </span>
                          ))}
                          {asgns.length === 0 && (
                            <span className="owner-chip">
                              <span className="owner-avatar">{ev.owner_name?.[0]?.toUpperCase()}</span>
                              {ev.owner_name}
                            </span>
                          )}
                          {asgns.length > 2 && (
                            <span className="chip-more">+{asgns.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="td-date">{formatDate(ev.created_at)}</td>
                      <td className="td-actions">
                        <button className="icon-btn" onClick={() => openEdit(ev)} title="Edit event">
                          <FiEdit2 size={15} />
                        </button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDeleteClick(ev)} title="Delete event">
                          <FiTrash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: card layout (≤600px) ── */}
          <div className="ae-events-cards">
            {events.map(ev => {
              const asgns = ev.assignments || [];
              return (
                <div key={ev.id} className="ae-event-card">
                  <div className="ae-ec-header">
                    <span className="ae-ec-name">{ev.name}</span>
                    <div className="td-actions ae-ec-actions">
                      <button className="icon-btn" onClick={() => openEdit(ev)} title="Edit event">
                        <FiEdit2 size={15} />
                      </button>
                      <button className="icon-btn icon-btn-red" onClick={() => handleDeleteClick(ev)} title="Delete event">
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {ev.description && (
                    <p className="ae-ec-desc">{ev.description}</p>
                  )}
                  <div className="ae-ec-row">
                    <span className="ae-ec-label">Target</span>
                    <span className="ae-ec-value td-money">{formatCurrency(ev.target_amount)}</span>
                  </div>
                  <div className="ae-ec-row">
                    <span className="ae-ec-label">Assigned To</span>
                    <div className="assignment-chips ae-ec-chips">
                      {asgns.slice(0, 2).map(a => (
                        <span key={a.user_id} className="owner-chip" title={`${a.user_name} — TZS ${parseFloat(a.target_amount).toLocaleString()}`}>
                          <span className="owner-avatar">{a.user_name?.[0]?.toUpperCase()}</span>
                          {a.user_name}
                        </span>
                      ))}
                      {asgns.length === 0 && (
                        <span className="owner-chip">
                          <span className="owner-avatar">{ev.owner_name?.[0]?.toUpperCase()}</span>
                          {ev.owner_name}
                        </span>
                      )}
                      {asgns.length > 2 && (
                        <span className="chip-more">+{asgns.length - 2}</span>
                      )}
                    </div>
                  </div>
                  <div className="ae-ec-row ae-ec-row-last">
                    <span className="ae-ec-label">Created</span>
                    <span className="ae-ec-value td-date">{formatDate(ev.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Event" size="large">
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label>Event Name *</label>
            <input
              value={createForm.name}
              onChange={e => { setCreateForm(p => ({ ...p, name: e.target.value })); setCreateErrors(p => ({ ...p, name: '' })); }}
              placeholder="e.g. Annual Fundraiser 2025"
            />
            {createErrors.name && <span className="field-error">{createErrors.name}</span>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={createForm.description}
              onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional description…"
            />
          </div>
          <div className="form-group">
            <label>Assign To *</label>
            <AssignmentForm
              clientUsers={clientUsers}
              selectedUsers={createUsers}
              setSelectedUsers={setCreateUsers}
              mode={createMode}
              setMode={setCreateMode}
            />
            {createErrors.assignments && <span className="field-error">{createErrors.assignments}</span>}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create Event'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit: ${editingEvent?.name || ''}`} size="large">
        <form onSubmit={handleEdit} noValidate>
          <div className="form-group">
            <label>Event Name *</label>
            <input
              value={editForm.name}
              onChange={e => { setEditForm(p => ({ ...p, name: e.target.value })); setEditErrors(p => ({ ...p, name: '' })); }}
              placeholder="Event name"
            />
            {editErrors.name && <span className="field-error">{editErrors.name}</span>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={editForm.description}
              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional description…"
            />
          </div>
          <div className="form-group">
            <label>Assigned Users *</label>
            <AssignmentForm
              clientUsers={clientUsers}
              selectedUsers={editUsers}
              setSelectedUsers={setEditUsers}
              mode={editMode}
              setMode={setEditMode}
            />
            {editErrors.assignments && <span className="field-error">{editErrors.assignments}</span>}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)} disabled={updating}>Cancel</button>
            <button type="submit" className="btn" disabled={updating}>{updating ? 'Saving…' : 'Save Changes'}</button>
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
