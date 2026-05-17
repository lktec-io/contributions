import { useState, useEffect, useRef } from 'react';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { contributorService } from '../../services/contributorService';
import './ContributorForm.css';

// ── Edit mode ────────────────────────────────────────────────
// Renders a single-event form (used from ContributorDetails).
function EditForm({ initialData, events, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    event_id:         initialData?.event_id         || '',
    contributor_name: initialData?.contributor_name || '',
    phone:            initialData?.phone            || '',
    email:            initialData?.email            || '',
    amount:           initialData?.amount           || '',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.contributor_name.trim()) errs.contributor_name = 'Name is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) errs.amount = 'Valid pledge amount required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...formData, amount: parseFloat(formData.amount) });
  };

  return (
    <form className="contributor-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label>Event</label>
        <select name="event_id" value={formData.event_id} disabled>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Contributor Name *</label>
        <input
          type="text"
          name="contributor_name"
          value={formData.contributor_name}
          onChange={handleChange}
          placeholder="Full name"
        />
        {errors.contributor_name && <span className="field-error">{errors.contributor_name}</span>}
      </div>

      <div className="cf-row">
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+255 712 345 678" />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
        </div>
      </div>

      <div className="form-group">
        <label>Pledge Amount (TZS) *</label>
        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          placeholder="0.00"
          min="0"
          step="0.01"
        />
        {errors.amount && <span className="field-error">{errors.amount}</span>}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="btn" disabled={loading}>{loading ? 'Saving…' : 'Update Contributor'}</button>
      </div>
    </form>
  );
}

// ── Add mode ─────────────────────────────────────────────────
// Multi-event selection with per-event target amounts.
function AddForm({ events, onSubmit, onCancel, loading }) {
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // { [event_id]: amount_string }
  const [assignments, setAssignments] = useState({});

  const [errors, setErrors]             = useState({});
  const [suggestions, setSuggestions]   = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTimer, setSearchTimer]   = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNameChange = (e) => {
    const q = e.target.value;
    setName(q);
    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));

    clearTimeout(searchTimer);
    if (q.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await contributorService.search(q.trim());
        const hits = res.data.data || [];
        setSuggestions(hits);
        setShowDropdown(hits.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);
    setSearchTimer(timer);
  };

  const selectSuggestion = (contributor) => {
    setName(contributor.name);
    setPhone(contributor.phone || '');
    setEmail(contributor.email || '');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const toggleEvent = (eventId) => {
    const key = String(eventId);
    setAssignments(prev => {
      const next = { ...prev };
      if (key in next) { delete next[key]; } else { next[key] = ''; }
      return next;
    });
    if (errors.events) setErrors(prev => ({ ...prev, events: '' }));
  };

  const setAmount = (eventId, value) => {
    setAssignments(prev => ({ ...prev, [String(eventId)]: value }));
    const key = `amount_${eventId}`;
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!name.trim())                    errs.name   = 'Name is required';
    if (Object.keys(assignments).length === 0) errs.events = 'Select at least one event';
    for (const [eid, amt] of Object.entries(assignments)) {
      if (!amt || parseFloat(amt) <= 0) errs[`amount_${eid}`] = 'Enter a valid amount';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const eventsList = Object.entries(assignments).map(([event_id, amount]) => ({
      event_id: parseInt(event_id, 10),
      amount:   parseFloat(amount),
    }));
    onSubmit({ contributor_name: name.trim(), phone: phone.trim(), email: email.trim(), events: eventsList });
  };

  const selectedCount = Object.keys(assignments).length;

  return (
    <form className="contributor-form" onSubmit={handleSubmit} noValidate>
      {/* ── Contributor identity ── */}
      <div className="form-group cf-name-wrap" ref={dropdownRef}>
        <label>Contributor Name *</label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Type to search or add new…"
          autoComplete="off"
        />
        {errors.name && <span className="field-error">{errors.name}</span>}

        {showDropdown && suggestions.length > 0 && (
          <ul className="cf-suggestions">
            {suggestions.map(s => (
              <li key={s.id} className="cf-suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                <span className="cf-sug-name">{s.name}</span>
                {(s.phone || s.email) && <span className="cf-sug-sub">{s.phone || s.email}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cf-row">
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255 712 345 678" />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
      </div>

      {/* ── Event assignments ── */}
      <div className="form-group">
        <label>
          Assign Events *
          {selectedCount > 0 && <span className="cf-event-count">{selectedCount} selected</span>}
        </label>
        {errors.events && <span className="field-error">{errors.events}</span>}

        {events.length === 0 ? (
          <p className="cf-no-events">No events available. Create an event first.</p>
        ) : (
          <div className="cf-event-list">
            {events.map(ev => {
              const key      = String(ev.id);
              const checked  = key in assignments;
              const amtError = errors[`amount_${ev.id}`];

              return (
                <div key={ev.id} className={`cf-event-item ${checked ? 'cf-event-item--selected' : ''}`}>
                  <button
                    type="button"
                    className="cf-event-toggle"
                    onClick={() => toggleEvent(ev.id)}
                    aria-pressed={checked}
                  >
                    {checked
                      ? <FiCheckSquare size={16} className="cf-check-icon cf-check-icon--on" />
                      : <FiSquare      size={16} className="cf-check-icon" />
                    }
                    <span className="cf-event-name">{ev.name}</span>
                  </button>

                  {checked && (
                    <div className="cf-event-amount">
                      <label className="cf-amount-label">Target Amount (TZS)</label>
                      <input
                        type="number"
                        value={assignments[key]}
                        onChange={e => setAmount(ev.id, e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={amtError ? 'cf-input-error' : ''}
                      />
                      {amtError && <span className="field-error">{amtError}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="btn" disabled={loading || selectedCount === 0}>
          {loading ? 'Saving…' : `Add Contributor${selectedCount > 1 ? ` to ${selectedCount} Events` : ''}`}
        </button>
      </div>
    </form>
  );
}

// ── Public export — routes to the right sub-form ────────────
export default function ContributorForm({ initialData, events, onSubmit, onCancel, loading }) {
  if (initialData) {
    return <EditForm initialData={initialData} events={events} onSubmit={onSubmit} onCancel={onCancel} loading={loading} />;
  }
  return <AddForm events={events} onSubmit={onSubmit} onCancel={onCancel} loading={loading} />;
}
