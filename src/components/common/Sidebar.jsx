import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiGrid, FiUsers, FiCalendar, FiList, FiHome, FiShield, FiSettings, FiArchive,
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
  const { user }        = useContext(AuthContext);
  const navigate        = useNavigate();
  const location        = useLocation();
  const onSettings      = location.pathname === '/settings';
  const onHiddenRecords = location.pathname === '/hidden-records';
  const isAdminRole     = user?.role === 'super_admin' || user?.role === 'admin';

  let items;
  if (user?.role === 'super_admin') {
    items = [...ADMIN_ITEMS, ...SUPER_ADMIN_EXTRA];
  } else if (user?.role === 'admin') {
    items = ADMIN_ITEMS;
  } else {
    items = CLIENT_ITEMS;
  }

  function handleSettings() {
    navigate('/settings');
    onClose?.();
  }

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
              className={`sidebar-item ${activeTab === id && !onSettings ? 'sidebar-item-active' : ''}`}
              onClick={() => { onTabChange(id); onClose?.(); }}
            >
              <Icon size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">{label}</span>
            </button>
          ))}

          {/* ── Hidden Records — admin/super_admin only ── */}
          {isAdminRole && (
            <button
              className={`sidebar-item ${onHiddenRecords ? 'sidebar-item-active' : ''}`}
              onClick={() => { navigate('/hidden-records'); onClose?.(); }}
            >
              <FiArchive size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">Hidden Records</span>
            </button>
          )}

          {/* ── Settings — pinned to bottom ──────────── */}
          <div className="sidebar-settings-section">
            <button
              className={`sidebar-item sidebar-settings-item ${onSettings ? 'sidebar-item-active' : ''}`}
              onClick={handleSettings}
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
