import { forwardRef, useEffect, useState } from 'react';
import {
  FiCalendar, FiDollarSign, FiCheckCircle, FiBell,
  FiEye, FiTrash2, FiCheck, FiX,
} from 'react-icons/fi';
import { formatDateTime } from '../../utils/formatters';
import './NotificationPanel.css';

const TYPE_ICONS = {
  event_assigned:     FiCalendar,
  contribution_added: FiDollarSign,
  payment_recorded:   FiCheckCircle,
  system:             FiBell,
};

const TYPE_COLORS = {
  event_assigned:     '#A78BFA',
  contribution_added: '#FFA500',
  payment_recorded:   '#00B894',
  system:             '#3B82F6',
};

const NotificationPanel = forwardRef(function NotificationPanel(
  { notifications, onMarkRead, onMarkAllRead, onDeleteOne, onDeleteAll, onClose, style },
  ref
) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const hasUnread = notifications.some(n => !n.is_read);
  const hasItems  = notifications.length > 0;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDeleteAll = () => {
    setConfirmDeleteAll(false);
    onDeleteAll();
  };

  return (
    <div className="notification-dropdown" ref={ref} style={style}>

      {/* ── Sticky header ── */}
      <div className="notification-header">
        <h3 className="notification-title">Notifications</h3>

        <div className="notification-header-actions">
          {hasUnread && (
            <button
              className="nd-hbtn nd-mark-all"
              onClick={onMarkAllRead}
              title="Mark all as read"
              aria-label="Mark all as read"
            >
              <FiCheck size={14} />
            </button>
          )}

          {hasItems && (
            confirmDeleteAll ? (
              <div className="nd-confirm-inline">
                <span className="nd-confirm-label">Delete all?</span>
                <button
                  className="nd-confirm-yes"
                  onClick={handleDeleteAll}
                  aria-label="Confirm delete all"
                >
                  <FiCheck size={12} />
                </button>
                <button
                  className="nd-confirm-no"
                  onClick={() => setConfirmDeleteAll(false)}
                  aria-label="Cancel"
                >
                  <FiX size={12} />
                </button>
              </div>
            ) : (
              <button
                className="nd-hbtn nd-delete-all"
                onClick={() => setConfirmDeleteAll(true)}
                title="Delete all notifications"
                aria-label="Delete all notifications"
              >
                <FiTrash2 size={14} />
              </button>
            )
          )}

          <button
            className="nd-hbtn nd-close"
            onClick={onClose}
            title="Close"
            aria-label="Close notifications"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <FiBell size={28} color="var(--text-muted)" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon  = TYPE_ICONS[n.type]  || FiBell;
            const color = TYPE_COLORS[n.type] || '#3B82F6';
            return (
              <div
                key={n.id}
                className={[
                  'notification-item',
                  !n.is_read  ? 'notification-item-unread'   : '',
                  n.removing  ? 'notification-item-removing' : '',
                ].filter(Boolean).join(' ')}
              >
                {/* inner wrapper is required by the grid-template-rows collapse trick */}
                <div className="ni-inner">
                  <span className="ni-icon" style={{ background: `${color}1F`, color }}>
                    <Icon size={14} />
                  </span>

                  <div className="ni-content">
                    <div className="ni-title">{n.title}</div>
                    <div className="ni-message">{n.message}</div>
                    <div className="ni-time">{formatDateTime(n.created_at)}</div>
                  </div>

                  <div className="ni-right">
                    <span className={n.is_read ? 'ni-dot ni-dot-hidden' : 'ni-dot'} />
                    <div className="notification-actions">
                      {!n.is_read && (
                        <button
                          className="ni-action ni-read"
                          onClick={() => onMarkRead(n.id)}
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <FiEye size={13} />
                        </button>
                      )}
                      <button
                        className="ni-action ni-delete"
                        onClick={() => onDeleteOne(n.id)}
                        title="Delete"
                        aria-label="Delete notification"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default NotificationPanel;
