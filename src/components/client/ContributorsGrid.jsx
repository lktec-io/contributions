import { FiEdit2, FiCreditCard, FiTrash2, FiUser, FiPhone, FiMail } from 'react-icons/fi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import './ContributorsGrid.css';

export default function ContributorsGrid({ contributions, loading, hasFilters, onEdit, onRecordPayment, onDelete }) {
  if (loading) return <div className="cg-loading"><LoadingSpinner size="large" /></div>;

  if (!contributions?.length) {
    return (
      <EmptyState
        IconComponent={FiUser}
        title="No contributors found"
        description={hasFilters ? 'Try adjusting your filters.' : 'Add a new contributor to get started.'}
      />
    );
  }

  return (
    <div className="contributors-grid">
      {contributions.map(c => {
        const outstanding = parseFloat(c.amount) - parseFloat(c.paid_amount);
        return (
          <div key={c.id} className="contributor-card">
            <div className="card-header">
              <div className="ccard-avatar">{c.contributor_name?.[0]?.toUpperCase()}</div>
              <div className="ccard-identity">
                <h4>{c.contributor_name}</h4>
                {c.event_name && <span className="ccard-event-tag">{c.event_name}</span>}
              </div>
              <span className={`status-badge ${c.status}`}>{c.status}</span>
            </div>

            <div className="card-body">
              <p>
                <FiPhone size={14} />
                <span>{c.phone || 'N/A'}</span>
              </p>
              <p>
                <FiMail size={14} />
                <span>{c.email || 'N/A'}</span>
              </p>
              <div className="card-amounts">
                <div className="card-amount-item">
                  <span className="card-amount-label">Pledged</span>
                  <span className="card-amount-value">{formatCurrency(c.amount)}</span>
                </div>
                <div className="card-amount-item">
                  <span className="card-amount-label">Paid</span>
                  <span className="card-amount-value ccard-paid">{formatCurrency(c.paid_amount)}</span>
                </div>
                <div className="card-amount-item">
                  <span className="card-amount-label">Outstanding</span>
                  <span className="card-amount-value ccard-outstanding">{formatCurrency(outstanding)}</span>
                </div>
              </div>
            </div>

            <div className="card-actions">
              <span className="ccard-date">{formatDate(c.created_at)}</span>
              <div className="ccard-btns">
                <button className="icon-btn" onClick={() => onEdit(c)} title="Edit contributor">
                  <FiEdit2 size={14} />
                </button>
                <button
                  className="icon-btn icon-btn-green"
                  onClick={() => onRecordPayment(c)}
                  title={c.status === 'paid' ? 'Fully paid' : 'Record payment'}
                  disabled={c.status === 'paid'}
                >
                  <FiCreditCard size={14} />
                </button>
                <button className="icon-btn icon-btn-red" onClick={() => onDelete(c)} title="Delete">
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
