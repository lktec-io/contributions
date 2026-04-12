import { useContext } from 'react';
import { FiSun, FiMoon, FiLogOut } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import NotificationBell from '../notifications/NotificationBell';
import './Header.css';

export default function Header({ onMenuToggle, menuOpen }) {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <header className="header">
      <div className="header-left">
        {/* Animated hamburger — 3 bars morph to X when open */}
        <button
          className={`header-icon-btn hamburger-btn ${menuOpen ? 'hamburger-open' : ''}`}
          onClick={onMenuToggle}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
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
