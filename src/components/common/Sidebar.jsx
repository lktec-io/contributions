import { useContext } from 'react';
import {
  FiGrid, FiUsers, FiCalendar, FiList, FiHome, FiShield,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import './Sidebar.css';

const ADMIN_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',       Icon: FiHome },
  { id: 'users',         label: 'User Management', Icon: FiUsers },
  { id: 'events',        label: 'Events',           Icon: FiCalendar },
  { id: 'contributions', label: 'Contributions',    Icon: FiGrid },
];

// Extra tab only shown to super_admin
const SUPER_ADMIN_EXTRA = [
  { id: 'admins', label: 'Admin Accounts', Icon: FiShield },
];

const CLIENT_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',       Icon: FiHome },
  { id: 'events',        label: 'My Events',        Icon: FiCalendar },
  { id: 'contributions', label: 'My Contributions', Icon: FiList },
];

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }) {
  const { user } = useContext(AuthContext);

  let items;
  if (user?.role === 'super_admin') {
    items = [...ADMIN_ITEMS, ...SUPER_ADMIN_EXTRA];
  } else if (user?.role === 'admin') {
    items = ADMIN_ITEMS;
  } else {
    items = CLIENT_ITEMS;
  }

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
              onClick={() => { onTabChange(id); onClose?.(); }}
            >
              <Icon size={20} className="sidebar-item-icon" />
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
