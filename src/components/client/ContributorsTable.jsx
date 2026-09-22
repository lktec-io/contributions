import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiEdit2, FiCreditCard, FiTrash2, FiUser, FiSend, FiCopy, FiMoreVertical } from 'react-icons/fi';
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

  // Presentation only — which row's overflow menu is open, and where to put it.
  // The menu renders through a portal because the table wrapper scrolls
  // horizontally and would otherwise clip it.
  const [menuFor, setMenuFor] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuAnchor = useRef(null);

  const MENU_W = 214;
  const MENU_H = 136;

  // Places the panel under its trigger, flipping above when the row sits
  // near the bottom of the viewport.
  const place = () => {
    const el = menuAnchor.current;
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8);
    const below = window.innerHeight - r.bottom;
    const top = below < MENU_H + 8 ? Math.max(8, r.top - MENU_H - 4) : r.bottom + 4;
    setMenuPos({ top, left });
  };

  const openMenu = (event, id) => {
    if (menuFor === id) { setMenuFor(null); return; }
    menuAnchor.current = event.currentTarget;
    place();
    setMenuFor(id);
  };

  useEffect(() => {
    if (menuFor == null) return undefined;
    const close = (e) => {
      if (e?.target?.closest?.('.ct-more, .ct-menu')) return;
      setMenuFor(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuFor(null); };
    // Follow the trigger rather than dismissing: clicking a control can scroll
    // it into view, which would otherwise close the menu the instant it opens.
    const onMove = () => place();
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [menuFor]);

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
      <table className="data-table data-table--stack contributors-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Event</th>
            <th>Pledged</th>
            <th>Kiasi Kilicholipwa</th>
            <th>Mizani Inayodaiwa</th>
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
                <td className="td-name" data-label="Name">{c.contributor_name}</td>
                <td className="td-secondary" data-label="Phone">{c.phone || '—'}</td>
                <td className="td-secondary" data-label="Email">{c.email || '—'}</td>
                <td data-label="Event">{c.event_name || '—'}</td>
                <td className="td-money" data-label="Pledged">{formatCurrency(c.amount)}</td>
                <td className="td-money td-paid" data-label="Kiasi Kilicholipwa">{formatCurrency(c.paid_amount)}</td>
                <td className="td-money td-outstanding" data-label="Mizani Inayodaiwa">{formatCurrency(outstanding)}</td>
                <td data-label="Status"><span className={getStatusBadgeClass(c.status)}>{c.status}</span></td>
                <td className="td-date" data-label="Date">{formatDate(c.created_at)}</td>
                <td className="td-actions" data-label="Actions">
                  {/* Two primary actions stay in reach; the rest live behind
                      the overflow menu so the ledger fits without scrolling. */}
                  <button className="icon-btn" onClick={() => onEdit(c)} title="Edit contributor" aria-label={`Edit ${c.contributor_name}`}>
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    className="icon-btn icon-btn-green"
                    onClick={() => onRecordPayment(c)}
                    title={c.status === 'paid' ? 'Fully paid' : 'Record payment'}
                    aria-label={`Record payment for ${c.contributor_name}`}
                    disabled={c.status === 'paid'}
                  >
                    <FiCreditCard size={16} />
                  </button>

                  <div className="ct-more">
                    <button
                      className="icon-btn"
                      onClick={(e) => openMenu(e, c.id)}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === c.id}
                      aria-label={`More actions for ${c.contributor_name}`}
                      title="More actions"
                    >
                      <FiMoreVertical size={16} />
                    </button>

                    {menuFor === c.id && createPortal(
                      <div
                        className="ct-menu"
                        role="menu"
                        style={{ top: menuPos.top, left: menuPos.left, width: MENU_W }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="ct-menu-item"
                          onClick={() => { setMenuFor(null); handleSendReminder(c); }}
                          disabled={!c.phone || isSending || isSent || c.status === 'paid'}
                        >
                          <FiSend size={14} className={isSending ? 'spin' : ''} />
                          {!c.phone ? 'No phone number' : isSent ? 'SMS already sent' : 'Send SMS reminder'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="ct-menu-item"
                          onClick={() => { setMenuFor(null); handleCopyLink(c); }}
                          disabled={!c.public_token}
                        >
                          <FiCopy size={14} />
                          {c.public_token ? 'Copy contribution link' : 'No public link yet'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="ct-menu-item is-danger"
                          onClick={() => { setMenuFor(null); onDelete(c); }}
                        >
                          <FiTrash2 size={14} />
                          Delete contributor
                        </button>
                      </div>,
                      document.body,
                    )}
                  </div>
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
