import { FiUser, FiEye } from 'react-icons/fi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { TableSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import './ContributorsTable.css';

export default function ContributorsTable({ contributors, loading, onView }) {
  if (loading) return <div className="contributors-table-wrap"><TableSkeleton rows={6} cols={7} /></div>;

  if (!contributors?.length) {
    return (
      <EmptyState
        IconComponent={FiUser}
        title="No contributors found"
        description="Try adjusting your filters or add a new contributor."
      />
    );
  }

  return (
    <div className="contributors-table-wrap">
      <table className="data-table contributors-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Events</th>
            <th>Total Pledged</th>
            <th>Total Paid</th>
            <th>Outstanding</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contributors.map(c => {
            const pledged     = parseFloat(c.total_pledged || 0);
            const paid        = parseFloat(c.total_paid    || 0);
            const outstanding = pledged - paid;

            return (
              <tr key={c.id} className="ct-row" onClick={() => onView(c)} title="Click to view events">
                <td className="td-name">{c.name}</td>
                <td className="td-secondary">{c.phone || '—'}</td>
                <td className="td-secondary">{c.email || '—'}</td>
                <td className="td-center">
                  <span className="ct-event-count">{c.event_count ?? 0}</span>
                </td>
                <td className="td-money">{formatCurrency(pledged)}</td>
                <td className="td-money td-paid">{formatCurrency(paid)}</td>
                <td className="td-money td-outstanding">{formatCurrency(outstanding)}</td>
                <td className="td-actions" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => onView(c)} title="View events">
                    <FiEye size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
