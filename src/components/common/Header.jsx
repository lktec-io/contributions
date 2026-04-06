import { useContext } from 'react';
import { FiMenu, FiSun, FiMoon, FiLogOut, FiEdit, FiTrash2, FiBell } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import NotificationBell from '../notifications/NotificationBell';
import './Header.css';

export default function Header({ onMenuToggle }) {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-icon-btn hamburger-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <FiMenu size={20} />
        </button>
      </div>

      <div className="header-right">
        <button
          className="header-icon-btn theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>

        <NotificationBell />

        <div className="header-user">
          <span className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
          <span className="user-name">{user?.name}</span>
        </div>

        <button className="logout-btn" onClick={logout} title="Logout">
          <FiLogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
