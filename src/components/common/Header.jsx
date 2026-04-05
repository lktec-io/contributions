import { useContext } from 'react';
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
        <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          ☰
        </button>
      </div>
      <div className="header-right">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <NotificationBell />
        <div className="header-user">
          <span className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
          <span className="user-name">{user?.name}</span>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          ⏻
        </button>
      </div>
    </header>
  );
}
