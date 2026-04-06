import { useContext } from 'react';
import {
  FiGrid, FiUsers, FiCalendar, FiList, FiHome,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import './Sidebar.css';

const ADMIN_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',       Icon: FiHome },
  { id: 'users',         label: 'User Management', Icon: FiUsers },
  { id: 'events',        label: 'Events',           Icon: FiCalendar },
  { id: 'contributions', label: 'Contributions',    Icon: FiGrid },
];

const CLIENT_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',         Icon: FiHome },
  { id: 'events',        label: 'My Events',          Icon: FiCalendar },
  { id: 'contributions', label: 'My Contributions',   Icon: FiList },
];

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const items = user?.role === 'super_admin' ? ADMIN_ITEMS : CLIENT_ITEMS;

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-mark">CT</span>
          <span className="sidebar-logo-text">ContribTrack</span>
        </div>

        <nav className="sidebar-nav">
          {items.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sidebar-item ${activeTab === id ? 'sidebar-item-active' : ''}`}
              onClick={() => { onTabChange(id); onClose && onClose(); }}
            >
              <Icon
                size={20}
                className="sidebar-item-icon"
              />
              <span className="sidebar-item-label">{label}</span>
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
