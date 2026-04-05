import { useState, useEffect } from 'react';
import './ContributorForm.css';

export default function ContributorForm({ initialData, events, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    event_id: '',
    contributor_name: '',
    phone: '',
    email: '',
    amount: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        event_id: initialData.event_id || '',
        contributor_name: initialData.contributor_name || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        amount: initialData.amount || '',
      });
    }
  }, [initialData]);

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
