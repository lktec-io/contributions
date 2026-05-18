import { useState } from 'react';
import { FiEdit2, FiCreditCard, FiTrash2, FiUser, FiPhone, FiMail, FiSend } from 'react-icons/fi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { smsService } from '../../services/smsService';
import { ContributorsGridSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import SuccessToast from '../common/SuccessToast';
import './ContributorsGrid.css';

export default function ContributorsGrid({ contributions, loading, hasFilters, onEdit, onRecordPayment, onDelete }) {
  const [smsSending,  setSmsSending]  = useState(new Set());
  const [smsSentIds,  setSmsSentIds]  = useState(new Set()); // session-level sent set (DB is authoritative on reload)
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSendReminder = async (c) => {
    if (!c.phone) return;
    setSmsSending(prev => new Set(prev).add(c.id));
    try {
      await smsService.sendReminder(c.id);
      setSmsSentIds(prev => new Set(prev).add(c.id));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch {
      // silent
    } finally {
      setSmsSending(prev => { const next = new Set(prev); next.delete(c.id); return next; });
    }
  };

  if (loading) return <ContributorsGridSkeleton count={6} />;

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
    <>
    <SuccessToast message="SMS sent successfully" show={showSuccess} />
    <div className="contributors-grid">
      {contributions.map(c => {
        const outstanding = parseFloat(c.amount) - parseFloat(c.paid_amount);
        const isSending   = smsSending.has(c.id);
        const isSent      = c.sms_sent || smsSentIds.has(c.id);
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
                  <FiEdit2 size={16} />
                </button>
                <button
                  className="icon-btn icon-btn-green"
                  onClick={() => onRecordPayment(c)}
                  title={c.status === 'paid' ? 'Fully paid' : 'Record payment'}
                  disabled={c.status === 'paid'}
                >
                  <FiCreditCard size={16} />
                </button>
                <button
                  className={`icon-btn icon-btn-sms ${isSent ? 'icon-btn-sms-sent' : ''}`}
                  onClick={() => handleSendReminder(c)}
                  title={!c.phone ? 'No phone number' : isSent ? 'SMS Sent' : 'Send SMS reminder'}
                  disabled={!c.phone || isSending || isSent || c.status === 'paid'}
                >
                  <FiSend size={15} className={isSending ? 'spin' : ''} />
                </button>
                <button className="icon-btn icon-btn-red" onClick={() => onDelete(c)} title="Delete">
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
