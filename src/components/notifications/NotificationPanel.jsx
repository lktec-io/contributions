import { forwardRef } from 'react';
import { FiCalendar, FiDollarSign, FiCheckCircle, FiBell } from 'react-icons/fi';
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
  { notifications, onMarkRead, onMarkAllRead, style },
  ref
) {
  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="notification-panel" ref={ref} style={style}>
      <div className="np-header">
        <h3 className="np-title">Notifications</h3>
        {hasUnread && (
          <button className="np-mark-all" onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="np-list">
        {notifications.length === 0 ? (
          <div className="np-empty">
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
                className={`np-item${!n.is_read ? ' np-item-unread' : ''}`}
                onClick={() => !n.is_read && onMarkRead(n.id)}
                role={!n.is_read ? 'button' : undefined}
                tabIndex={!n.is_read ? 0 : undefined}
              >
                <span className="np-icon" style={{ background: `${color}1F`, color }}>
                  <Icon size={14} />
                </span>
                <div className="np-content">
                  <div className="np-item-title">{n.title}</div>
                  <div className="np-item-message">{n.message}</div>
                  <div className="np-item-time">{formatDateTime(n.created_at)}</div>
                </div>
                {!n.is_read && <span className="np-dot" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default NotificationPanel;
