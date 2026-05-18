import { useState, useEffect, useRef } from 'react';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { contributorService } from '../../services/contributorService';
import './ContributorForm.css';

// ── Currency helpers ──────────────────────────────────────────
const formatCommas = (val) => {
  if (val === '' || val == null) return '';
  const str = String(val).replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(str)) return String(val);
  const [int, dec] = str.split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${formatted}.${dec}` : formatted;
};
const stripCommas = (val) => String(val).replace(/,/g, '');

// ── EDIT MODE ─────────────────────────────────────────────────
// Single-event form, used when editing an existing contribution.
// Behaviour is exactly the same as the original ContributorForm.
function EditForm({ initialData, events, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    event_id:         initialData?.event_id         || '',
    contributor_name: initialData?.contributor_name || '',
    phone:            initialData?.phone            || '',
    email:            initialData?.email            || '',
    amount:           initialData?.amount != null ? String(initialData.amount) : '',
  });
  const [errors, setErrors] = useState({});
  const phoneRef  = useRef(null);
  const emailRef  = useRef(null);
  const amountRef = useRef(null);

  const validate = () => {
    const errs = {};
    if (!formData.contributor_name.trim()) errs.contributor_name = 'Name is required';
    if (!formData.amount || parseFloat(stripCommas(formData.amount)) <= 0) errs.amount = 'Valid pledge amount required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const raw = stripCommas(value);
      if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
        setFormData(prev => ({ ...prev, amount: raw }));
      }
      if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, phone: val }));
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 12) emailRef.current?.focus();
  };

  const advanceOn = (nextRef) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nextRef.current?.focus(); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...formData, amount: parseFloat(stripCommas(formData.amount)) });
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
          onKeyDown={advanceOn(phoneRef)}
          placeholder="Full name"
        />
        {errors.contributor_name && <span className="field-error">{errors.contributor_name}</span>}
      </div>

      <div className="cf-row">
        <div className="form-group">
          <label>Phone</label>
          <input
            ref={phoneRef}
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handlePhoneChange}
            onKeyDown={advanceOn(emailRef)}
            placeholder="+255 712 345 678"
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            ref={emailRef}
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onKeyDown={advanceOn(amountRef)}
            placeholder="email@example.com"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Pledge Amount (TZS) *</label>
        <input
          ref={amountRef}
          type="text"
          inputMode="decimal"
          name="amount"
          value={formatCommas(formData.amount)}
          onChange={handleChange}
          placeholder="0"
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

// ── ADD MODE ──────────────────────────────────────────────────
// Multi-event form: one contributor, many event assignments.
// Shows a checkbox list of events; each checked event reveals
// its own target amount input.
function AddForm({ events, onSubmit, onCancel, loading }) {
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // { [event_id_string]: amount_string } — stores raw numeric strings
  const [assignments, setAssignments] = useState({});

  const [errors,       setErrors]       = useState({});
  const [suggestions,  setSuggestions]  = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTimer,  setSearchTimer]  = useState(null);
  const dropdownRef = useRef(null);
  const phoneRef    = useRef(null);
  const emailRef    = useRef(null);

  const advanceOn = (nextRef) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nextRef.current?.focus(); }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 12) emailRef.current?.focus();
  };

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
    const raw = stripCommas(value);
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    const key = String(eventId);
    setAssignments(prev => ({ ...prev, [key]: raw }));
    const errKey = `amount_${eventId}`;
    if (errors[errKey]) setErrors(prev => ({ ...prev, [errKey]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (Object.keys(assignments).length === 0) errs.events = 'Select at least one event';
    for (const [eid, amt] of Object.entries(assignments)) {
      if (!amt || parseFloat(stripCommas(amt)) <= 0) errs[`amount_${eid}`] = 'Enter a valid amount';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const eventsList = Object.entries(assignments).map(([event_id, amount]) => ({
      event_id: parseInt(event_id, 10),
      amount:   parseFloat(stripCommas(amount)),
    }));
    onSubmit({
      contributor_name: name.trim(),
      phone:            phone.trim() || null,
      email:            email.trim() || null,
      events:           eventsList,
    });
  };

  const selectedCount = Object.keys(assignments).length;

  return (
    <form className="contributor-form" onSubmit={handleSubmit} noValidate>

      {/* ── Contributor identity ─────────────────────────────── */}
      <div className="form-group cf-name-wrap" ref={dropdownRef}>
        <label>Contributor Name *</label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          onKeyDown={advanceOn(phoneRef)}
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
          <input
            ref={phoneRef}
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            onKeyDown={advanceOn(emailRef)}
            placeholder="+255 712 345 678"
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </div>

      {/* ── Event assignments ─────────────────────────────────── */}
      <div className="form-group">
        <label>
          Assign to Events *
          {selectedCount > 0 && (
            <span className="cf-event-badge">{selectedCount} selected</span>
          )}
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
                <div key={ev.id} className={`cf-event-item${checked ? ' cf-event-item--on' : ''}`}>
                  <button
                    type="button"
                    className="cf-event-toggle"
                    onClick={() => toggleEvent(ev.id)}
                    aria-pressed={checked}
                  >
                    {checked
                      ? <FiCheckSquare size={16} className="cf-check cf-check--on" />
                      : <FiSquare      size={16} className="cf-check" />
                    }
                    <span className="cf-event-label">{ev.name}</span>
                  </button>

                  {checked && (
                    <div className="cf-event-amount">
                      <span className="cf-amount-label">Target Amount (TZS)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatCommas(assignments[key])}
                        onChange={e => setAmount(ev.id, e.target.value)}
                        placeholder="0"
                        className={amtError ? 'cf-input-err' : ''}
                        autoComplete="off"
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
          {loading
            ? 'Saving…'
            : selectedCount > 1
              ? `Add to ${selectedCount} Events`
              : 'Add Contributor'}
        </button>
      </div>
    </form>
  );
}

// ── Public export ─────────────────────────────────────────────
export default function ContributorForm(props) {
  if (props.initialData) return <EditForm {...props} />;
  return <AddForm {...props} />;
}
