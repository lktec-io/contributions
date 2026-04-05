import { useContext } from 'react';
import { ToastContext } from '../../context/ToastContext';
import './Toast.css';

export default function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext);
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success'
              ? '✓'
              : toast.type === 'error'
              ? '✕'
              : toast.type === 'warning'
              ? '⚠'
              : 'ℹ'}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
