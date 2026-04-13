import { useState } from 'react';
import { FiEdit2, FiCreditCard, FiTrash2, FiUser, FiSend } from 'react-icons/fi';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { smsService } from '../../services/smsService';
import { TableSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import './ContributorsTable.css';

export default function ContributorsTable({ contributions, loading, onEdit, onRecordPayment, onDelete }) {
  const [smsSending, setSmsSending] = useState(new Set());
  const [smsSuccess, setSmsSuccess] = useState(new Set());

  const handleSendReminder = async (c) => {
    if (!c.phone) return;
    setSmsSending(prev => new Set(prev).add(c.id));
    try {
      await smsService.sendReminder(c.id);
      setSmsSuccess(prev => {
        const next = new Set(prev).add(c.id);
        // clear success indicator after 3 s
        setTimeout(() => setSmsSuccess(s => { const n = new Set(s); n.delete(c.id); return n; }), 3000);
        return next;
      });
    } catch {
      // silent fail — toast is shown by api interceptor
    } finally {
      setSmsSending(prev => { const next = new Set(prev); next.delete(c.id); return next; });
    }
  };

  if (loading) return <div className="contributors-table-wrap"><TableSkeleton rows={6} cols={10} /></div>;

  if (!contributions?.length) {
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
            const isSending   = smsSending.has(c.id);
            const isSent      = smsSuccess.has(c.id);
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
                  <button
                    className={`icon-btn icon-btn-sms ${isSent ? 'icon-btn-sms-sent' : ''}`}
                    onClick={() => handleSendReminder(c)}
                    title={!c.phone ? 'No phone number' : isSent ? 'Reminder sent!' : 'Send SMS reminder'}
                    disabled={!c.phone || isSending || c.status === 'paid'}
                  >
                    <FiSend size={13} className={isSending ? 'spin' : ''} />
                  </button>
                  <button className="icon-btn icon-btn-red" onClick={() => onDelete(c)} title="Delete">
                    <FiTrash2 size={14} />
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
