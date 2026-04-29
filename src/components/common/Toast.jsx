import { useContext } from 'react';
import { FiCheck, FiX, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import './Toast.css';

const ICONS = {
  success: FiCheck,
  error:   FiX,
  warning: FiAlertTriangle,
  info:    FiInfo,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext);
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map(t => {
        const Icon = ICONS[t.type] || FiInfo;
        return (
          <div
            key={t.id}
            className={`toast toast-${t.type}${t.exiting ? ' toast-exiting' : ''}`}
            role="alert"
          >
            <span className="toast-icon"><Icon size={15} /></span>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss">
              <FiX size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
