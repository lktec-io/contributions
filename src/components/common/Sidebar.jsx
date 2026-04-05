import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import './Sidebar.css';

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }) {
  const { user } = useContext(AuthContext);

  const adminItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'events', label: 'Events', icon: '🎉' },
    { id: 'contributions', label: 'Contributions', icon: '💰' },
  ];

  const clientItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'events', label: 'My Events', icon: '🎉' },
    { id: 'contributions', label: 'My Contributions', icon: '💰' },
  ];

  const items = user?.role === 'super_admin' ? adminItems : clientItems;

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🏦</span>
          <span className="sidebar-logo-text">ContribTrack</span>
        </div>
        <nav className="sidebar-nav">
          {items.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'sidebar-item-active' : ''}`}
              onClick={() => {
                onTabChange(item.id);
                onClose && onClose();
              }}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-version">v1.0.0</span>
        </div>
      </aside>
    </>
  );
}
