import { FiEdit2, FiCreditCard, FiTrash2, FiUser } from 'react-icons/fi';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
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
            <div className="ccard-header">
              <div className="ccard-avatar">{c.contributor_name?.[0]?.toUpperCase()}</div>
              <div className="ccard-identity">
                <span className="ccard-name">{c.contributor_name}</span>
                {c.phone && <span className="ccard-phone">{c.phone}</span>}
              </div>
              <span className={getStatusBadgeClass(c.status)}>{c.status}</span>
            </div>

            {c.event_name && (
              <div className="ccard-event">{c.event_name}</div>
            )}

            <div className="ccard-amounts">
              <div className="ccard-amount-item">
                <span className="ccard-amount-label">Pledged</span>
                <span className="ccard-amount-value">{formatCurrency(c.amount)}</span>
              </div>
              <div className="ccard-amount-item">
                <span className="ccard-amount-label">Paid</span>
                <span className="ccard-amount-value ccard-paid">{formatCurrency(c.paid_amount)}</span>
              </div>
              <div className="ccard-amount-item">
                <span className="ccard-amount-label">Outstanding</span>
                <span className="ccard-amount-value ccard-outstanding">{formatCurrency(outstanding)}</span>
              </div>
            </div>

            <div className="ccard-footer">
              <span className="ccard-date">{formatDate(c.created_at)}</span>
              <div className="ccard-actions">
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
