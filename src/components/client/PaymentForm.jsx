import { useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import './PaymentForm.css';

export default function PaymentForm({ contribution, onSubmit, onCancel, loading }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const pledged = parseFloat(contribution?.amount || 0);
  const paid = parseFloat(contribution?.paid_amount || 0);
  const outstanding = pledged - paid;

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Enter a valid payment amount');
      return;
    }
    if (amt > outstanding + 0.001) {
      setError(`Cannot exceed outstanding balance of ${formatCurrency(outstanding)}`);
      return;
    }
    setError('');
    onSubmit({ contribution_id: contribution.id, amount: amt, note: note.trim() || undefined });
  };

  const isFullyPaid = outstanding <= 0;

  return (
    <form className="payment-form" onSubmit={handleSubmit} noValidate>
      <div className="payment-summary">
        <div className="ps-row">
          <span className="ps-label">Contributor</span>
          <strong className="ps-value">{contribution?.contributor_name}</strong>
        </div>
        <div className="ps-row">
          <span className="ps-label">Pledge Amount</span>
          <strong className="ps-value">{formatCurrency(pledged)}</strong>
        </div>
        <div className="ps-row">
          <span className="ps-label">Already Paid</span>
          <strong className="ps-value ps-paid">{formatCurrency(paid)}</strong>
        </div>
        <div className="ps-divider" />
        <div className="ps-row ps-row-outstanding">
          <span className="ps-label">Outstanding</span>
          <strong className="ps-outstanding">{formatCurrency(outstanding)}</strong>
        </div>
      </div>

      {isFullyPaid ? (
        <div className="pf-fully-paid">
          <FiCheckCircle size={32} color="var(--accent-green)" />
          <p>This contribution is fully paid.</p>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>Payment Amount (TZS) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(''); }}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              max={outstanding}
            />
            {error && <span className="field-error">{error}</span>}
          </div>

          <div className="form-group">
            <label>Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Payment reference or notes…"
              rows={3}
            />
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        {!isFullyPaid && (
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Recording…' : 'Record Payment'}
          </button>
        )}
      </div>
    </form>
  );
}
