import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import './ContributorsTable.css';

export default function ContributorsTable({ contributions, loading, onEdit, onRecordPayment, onDelete }) {
  if (loading) return <div className="ct-loading"><LoadingSpinner size="large" /></div>;

  if (!contributions?.length) {
    return (
      <EmptyState
        icon="👤"
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
            <th>Event</th>
            <th>Pledged</th>
            <th>Paid</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map(c => {
            const outstanding = parseFloat(c.amount) - parseFloat(c.paid_amount);
            return (
              <tr key={c.id}>
                <td className="td-name">{c.contributor_name}</td>
                <td className="td-secondary">{c.phone || '—'}</td>
                <td className="td-secondary">{c.email || '—'}</td>
                <td>{c.event_name || '—'}</td>
                <td className="td-money">{formatCurrency(c.amount)}</td>
                <td className="td-money td-paid">{formatCurrency(c.paid_amount)}</td>
                <td className="td-money td-outstanding">{formatCurrency(outstanding)}</td>
                <td><span className={getStatusBadgeClass(c.status)}>{c.status}</span></td>
                <td className="td-date">{formatDate(c.created_at)}</td>
                <td className="td-actions">
                  <button className="icon-btn" onClick={() => onEdit(c)} title="Edit contributor">
                    ✏️
                  </button>
                  <button
                    className="icon-btn icon-btn-green"
                    onClick={() => onRecordPayment(c)}
                    title={c.status === 'paid' ? 'Fully paid' : 'Record payment'}
                    disabled={c.status === 'paid'}
                  >
                    💳
                  </button>
                  <button className="icon-btn icon-btn-red" onClick={() => onDelete(c)} title="Delete">
                    🗑️
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
