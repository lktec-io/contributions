import { useState, useEffect, useRef } from 'react';
import { contributorService } from '../../services/contributorService';
import './ContributorForm.css';

export default function ContributorForm({ initialData, events, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    event_id: '',
    contributor_name: '',
    phone: '',
    email: '',
    amount: '',
  });
  const [errors, setErrors]         = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTimer, setSearchTimer]   = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        event_id:         initialData.event_id         || '',
        contributor_name: initialData.contributor_name || '',
        phone:            initialData.phone            || '',
        email:            initialData.email            || '',
        amount:           initialData.amount           || '',
      });
    }
  }, [initialData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validate = () => {
    const errs = {};
    if (!formData.event_id) errs.event_id = 'Event is required';
    if (!formData.contributor_name.trim()) errs.contributor_name = 'Name is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) errs.amount = 'Valid pledge amount required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));

    // Trigger contributor search when typing in the name field (add mode only)
    if (name === 'contributor_name' && !initialData) {
      clearTimeout(searchTimer);
      const q = value.trim();
      if (q.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      const timer = setTimeout(async () => {
        try {
          const res = await contributorService.search(q);
          const hits = res.data.data || [];
          setSuggestions(hits);
          setShowDropdown(hits.length > 0);
        } catch {
          setSuggestions([]);
          setShowDropdown(false);
        }
      }, 300);
      setSearchTimer(timer);
    }
  };

  const selectSuggestion = (contributor) => {
    setFormData(prev => ({
      ...prev,
      contributor_name: contributor.name,
      phone:            contributor.phone || '',
      email:            contributor.email || '',
    }));
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...formData, amount: parseFloat(formData.amount) });
  };

  const isEdit = !!initialData;

  return (
    <form className="contributor-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label>Event *</label>
        <select name="event_id" value={formData.event_id} onChange={handleChange} disabled={isEdit}>
          <option value="">Select an event…</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        {errors.event_id && <span className="field-error">{errors.event_id}</span>}
      </div>

      {/* Name with contributor search (add mode only) */}
      <div className="form-group cf-name-wrap" ref={dropdownRef}>
        <label>Contributor Name *</label>
        <input
          type="text"
          name="contributor_name"
          value={formData.contributor_name}
          onChange={handleChange}
          placeholder={isEdit ? 'Full name' : 'Type to search or add new…'}
          autoComplete="off"
        />
        {errors.contributor_name && <span className="field-error">{errors.contributor_name}</span>}

        {showDropdown && suggestions.length > 0 && (
          <ul className="cf-suggestions">
            {suggestions.map(s => (
              <li key={s.id} className="cf-suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                <span className="cf-sug-name">{s.name}</span>
                {(s.phone || s.email) && (
                  <span className="cf-sug-sub">{s.phone || s.email}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cf-row">
        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+255 712 345 678"
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@example.com"
          />
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
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Update Contributor' : 'Add Contributor'}
        </button>
      </div>
    </form>
  );
}
