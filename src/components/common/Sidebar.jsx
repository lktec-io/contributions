import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiGrid, FiUsers, FiCalendar, FiList, FiHome, FiShield, FiSettings, FiArchive,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import './Sidebar.css';

// Maps sidebar tab IDs to their URL paths
const TAB_PATHS = {
  dashboard:     '/dashboard',
  users:         '/users',
  events:        '/events',
  contributions: '/contributions',
  admins:        '/admins',
};

const ADMIN_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',       Icon: FiHome },
  { id: 'users',         label: 'User Management', Icon: FiUsers },
  { id: 'events',        label: 'Events',           Icon: FiCalendar },
  { id: 'contributions', label: 'Contributions',    Icon: FiGrid },
];

const SUPER_ADMIN_EXTRA = [
  { id: 'admins', label: 'Admin Accounts', Icon: FiShield },
];

const CLIENT_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',       Icon: FiHome },
  { id: 'events',        label: 'My Events',        Icon: FiCalendar },
  { id: 'contributions', label: 'My Contributions', Icon: FiList },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user }    = useContext(AuthContext);
  const navigate    = useNavigate();
  const location    = useLocation();
  const pathname    = location.pathname;
  const isAdminRole = user?.role === 'super_admin' || user?.role === 'admin';

  let items;
  if (user?.role === 'super_admin') {
    items = [...ADMIN_ITEMS, ...SUPER_ADMIN_EXTRA];
  } else if (user?.role === 'admin') {
    items = ADMIN_ITEMS;
  } else {
    items = CLIENT_ITEMS;
  }

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  const isTabActive = (id) => TAB_PATHS[id] === pathname;

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-mark">FH</span>
          <span className="sidebar-logo-text">Finance Hub</span>
        </div>

        <nav className="sidebar-nav">
          {items.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sidebar-item ${isTabActive(id) ? 'sidebar-item-active' : ''}`}
              onClick={() => handleNav(TAB_PATHS[id])}
            >
              <Icon size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">{label}</span>
            </button>
          ))}

          {/* ── Hidden Records — admin/super_admin only ── */}
          {isAdminRole && (
            <button
              className={`sidebar-item ${pathname === '/hidden-records' ? 'sidebar-item-active' : ''}`}
              onClick={() => handleNav('/hidden-records')}
            >
              <FiArchive size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">Hidden Records</span>
            </button>
          )}

          {/* ── Settings — pinned to bottom ──────────── */}
          <div className="sidebar-settings-section">
            <button
              className={`sidebar-item sidebar-settings-item ${pathname === '/settings' ? 'sidebar-item-active' : ''}`}
              onClick={() => handleNav('/settings')}
            >
              <FiSettings size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">Settings</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-version">v1.0.0</span>
        </div>
      </aside>
    </>
  );
}
