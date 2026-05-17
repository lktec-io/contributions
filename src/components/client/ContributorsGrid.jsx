import { FiUser, FiPhone, FiMail, FiCalendar, FiEye } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { ContributorsGridSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import './ContributorsGrid.css';

export default function ContributorsGrid({ contributors, loading, hasFilters, onView }) {
  if (loading) return <ContributorsGridSkeleton count={6} />;

  if (!contributors?.length) {
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
      {contributors.map(c => {
        const pledged     = parseFloat(c.total_pledged || 0);
        const paid        = parseFloat(c.total_paid    || 0);
        const outstanding = pledged - paid;

        return (
          <div key={c.id} className="contributor-card cg-clickable" onClick={() => onView(c)}>
            <div className="card-header">
              <div className="ccard-avatar">{c.name?.[0]?.toUpperCase()}</div>
              <div className="ccard-identity">
                <h4>{c.name}</h4>
                <span className="ccard-event-tag">
                  <FiCalendar size={11} /> {c.event_count ?? 0} event{(c.event_count ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="icon-btn cg-view-btn"
                onClick={e => { e.stopPropagation(); onView(c); }}
                title="View events"
              >
                <FiEye size={15} />
              </button>
            </div>

            <div className="card-body">
              <p><FiPhone size={14} /><span>{c.phone || 'N/A'}</span></p>
              <p><FiMail  size={14} /><span>{c.email || 'N/A'}</span></p>
              <div className="card-amounts">
                <div className="card-amount-item">
                  <span className="card-amount-label">Pledged</span>
                  <span className="card-amount-value">{formatCurrency(pledged)}</span>
                </div>
                <div className="card-amount-item">
                  <span className="card-amount-label">Paid</span>
                  <span className="card-amount-value ccard-paid">{formatCurrency(paid)}</span>
                </div>
                <div className="card-amount-item">
                  <span className="card-amount-label">Outstanding</span>
                  <span className="card-amount-value ccard-outstanding">{formatCurrency(outstanding)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
