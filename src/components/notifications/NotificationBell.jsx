import { useState, useContext, useEffect, useRef } from 'react';
import { FiBell } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';
import './NotificationBell.css';

export default function NotificationBell() {
  const { user } = useContext(AuthContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const bellRef = useRef(null);
  const { unreadCount, notifications, fetchNotifications, markRead, markAllRead } = useNotifications(!!user);

  const handleBellClick = () => {
    if (!panelOpen) fetchNotifications();
    setPanelOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="notification-bell" ref={bellRef}>
      <button className="bell-btn header-icon-btn" onClick={handleBellClick} aria-label="Notifications">
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
      {panelOpen && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
