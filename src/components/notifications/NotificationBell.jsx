import { useState, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiBell } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';
import './NotificationBell.css';

export default function NotificationBell() {
  const { user } = useContext(AuthContext);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const bellRef  = useRef(null);
  const panelRef = useRef(null);

  const { unreadCount, notifications, fetchNotifications, markRead, markAllRead } =
    useNotifications(!!user);

  const handleBellClick = () => {
    if (!panelOpen) {
      fetchNotifications();
      // Calculate desktop anchor position from the bell's viewport rect.
      // On mobile these values are overridden by CSS media query, but we
      // always compute them so the panel can open correctly on any resize.
      const rect = bellRef.current?.getBoundingClientRect();
      if (rect) {
        setPanelStyle({
          '--np-top':   `${Math.round(rect.bottom + 10)}px`,
          '--np-right': `${Math.round(window.innerWidth - rect.right)}px`,
        });
      }
    }
    setPanelOpen(prev => !prev);
  };

  // Close on outside click — must check both bell AND panel since the panel
  // is now a portal child of body, not a DOM descendant of bellRef.
  useEffect(() => {
    const handleOutside = (e) => {
      if (
        bellRef.current  && !bellRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="notification-bell" ref={bellRef}>
      <button
        className="bell-btn header-icon-btn"
        onClick={handleBellClick}
        aria-label="Notifications"
        aria-expanded={panelOpen}
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {panelOpen && createPortal(
        <>
          {/* Mobile-only dimmed backdrop — tap to close */}
          <div
            className="np-backdrop"
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />
          <NotificationPanel
            ref={panelRef}
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onClose={() => setPanelOpen(false)}
            style={panelStyle}
          />
        </>,
        document.body
      )}
    </div>
  );
}
