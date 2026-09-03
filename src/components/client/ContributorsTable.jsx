import { useState } from 'react';
import { FiEdit2, FiCreditCard, FiTrash2, FiUser, FiSend, FiCopy } from 'react-icons/fi';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { smsService } from '../../services/smsService';
import { copyToClipboard } from '../../utils/clipboard';
import { TableSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import SuccessToast from '../common/SuccessToast';
import SmsSendingModal from '../common/SmsSendingModal';
import './ContributorsTable.css';

export default function ContributorsTable({ contributions, loading, onEdit, onRecordPayment, onDelete }) {
  const [smsSending,  setSmsSending]  = useState(new Set());
  const [smsSentIds,  setSmsSentIds]  = useState(new Set()); // session-level sent set (DB is authoritative on reload)
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCopied,  setShowCopied]  = useState(false);
  const [smsModal,    setSmsModal]    = useState({ open: false, status: 'sending' }); // visual feedback only

  const handleSendReminder = async (c) => {
    if (!c.phone) return;
    setSmsModal({ open: true, status: 'sending' });
    setSmsSending(prev => new Set(prev).add(c.id));
    try {
      await smsService.sendReminder(c.id);
      // Mark as sent for this session — DB field sms_sent persists across reloads
      setSmsSentIds(prev => new Set(prev).add(c.id));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setSmsModal({ open: true, status: 'success' });
    } catch {
      // silent fail — toast is shown by api interceptor
      setSmsModal({ open: true, status: 'error' });
    } finally {
      setSmsSending(prev => { const next = new Set(prev); next.delete(c.id); return next; });
    }
  };

  const handleCopyLink = async (c) => {
    if (!c.public_token) return;
    const ok = await copyToClipboard(`${window.location.origin}/pay/${c.public_token}`);
    if (ok) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
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
    <>
    <SuccessToast message="SMS sent successfully" show={showSuccess} />
    <SuccessToast message="Link copied successfully" show={showCopied} />
    <SmsSendingModal
      open={smsModal.open}
      status={smsModal.status}
      onClose={() => setSmsModal({ open: false, status: 'sending' })}
    />
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
            const isSent      = c.sms_sent || smsSentIds.has(c.id);
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
                  <button
                    className="icon-btn"
                    onClick={() => handleCopyLink(c)}
                    title={c.public_token ? 'Copy public contribution link' : 'No public link yet'}
                    disabled={!c.public_token}
                  >
                    <FiCopy size={15} />
                  </button>
                  <button className="icon-btn icon-btn-red" onClick={() => onDelete(c)} title="Delete">
                    <FiTrash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
