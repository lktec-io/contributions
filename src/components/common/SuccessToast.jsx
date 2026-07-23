import { FiCheckCircle } from 'react-icons/fi';
import './SuccessToast.css';

export default function SuccessToast({ message, title, show, icon: Icon = FiCheckCircle }) {
  return (
    <div className={`success-toast ${title ? 'success-toast-full' : ''} ${show ? 'show' : ''}`} aria-live="polite">
      <Icon size={title ? 26 : 17} className="success-toast-icon" />
      <div className="success-toast-text">
        {title && <span className="success-toast-title">{title}</span>}
        {message && <span className="success-toast-message">{message}</span>}
      </div>
    </div>
  );
}
