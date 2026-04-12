import { useState, useEffect } from 'react';
import { FiX, FiStar } from 'react-icons/fi';
import './WelcomePopup.css';

/**
 * WelcomePopup — slide-up bottom notification shown after login.
 * Auto-dismisses after 3.5 s.
 */
export default function WelcomePopup({ name, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setMounted(false);
      onDismiss?.();
    }, 380);
  };

  if (!mounted) return null;

  return (
    <div className={`welcome-popup ${leaving ? 'welcome-popup-out' : ''}`} role="status">
      <div className="welcome-popup-icon">
        <FiStar size={15} />
      </div>
      <p className="welcome-popup-text">
        Welcome back, <strong>{name}</strong>!
      </p>
      <button
        type="button"
        className="welcome-popup-close"
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        <FiX size={13} />
      </button>
    </div>
  );
}
