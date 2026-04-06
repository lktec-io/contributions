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
    <div className="toast-container">
      {toasts.map(toast => {
        const Icon = ICONS[toast.type] || FiInfo;
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon"><Icon size={15} /></span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <FiX size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
