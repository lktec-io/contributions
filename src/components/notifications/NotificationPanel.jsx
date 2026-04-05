import './NotificationPanel.css';
import { formatDateTime } from '../../utils/formatters';

const TYPE_ICONS = {
  event_assigned: '🎉',
  contribution_added: '💰',
  payment_recorded: '✅',
  system: '🔔',
};

export default function NotificationPanel({ notifications, onMarkRead, onMarkAllRead }) {
  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="notification-panel">
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
            <span className="np-empty-icon">🔔</span>
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`np-item ${!n.is_read ? 'np-item-unread' : ''}`}
              onClick={() => !n.is_read && onMarkRead(n.id)}
              role={!n.is_read ? 'button' : undefined}
              tabIndex={!n.is_read ? 0 : undefined}
            >
              <span className="np-icon">{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="np-content">
                <div className="np-item-title">{n.title}</div>
                <div className="np-item-message">{n.message}</div>
                <div className="np-item-time">{formatDateTime(n.created_at)}</div>
              </div>
              {!n.is_read && <span className="np-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
