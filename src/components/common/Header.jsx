import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSun, FiMoon, FiLogOut, FiSettings } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import NotificationBell from '../notifications/NotificationBell';
import './Header.css';

export default function Header({ onMenuToggle, menuOpen }) {
  const { user, logout }        = useContext(AuthContext);
  const { theme, toggleTheme }  = useContext(ThemeContext);
  const navigate                = useNavigate();
  const [iconSpin,       setIconSpin]       = useState(false);
  const [hamburgerPulse, setHamburgerPulse] = useState(false);

  function handleThemeToggle() {
    setIconSpin(true);
    toggleTheme();
  }

  function handleMenuToggle() {
    setHamburgerPulse(true);
    onMenuToggle();
  }

  return (
    <header className="header">
      <div className="header-left">
        {/* Animated hamburger — 3 bars morph to X when open */}
        <button
          className={`header-icon-btn hamburger-btn${menuOpen ? ' hamburger-open' : ''}${hamburgerPulse ? ' hamburger-pulse' : ''}`}
          onClick={handleMenuToggle}
          onAnimationEnd={() => setHamburgerPulse(false)}
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
          className={`header-icon-btn theme-toggle${iconSpin ? ' theme-icon-spinning' : ''}`}
          onClick={handleThemeToggle}
          onAnimationEnd={() => setIconSpin(false)}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>

        <NotificationBell />

        <button
          className="header-icon-btn"
          onClick={() => navigate('/settings')}
          title="Settings"
          aria-label="Settings"
        >
          <FiSettings size={18} />
        </button>

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
