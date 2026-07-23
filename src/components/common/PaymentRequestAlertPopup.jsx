import { useNavigate } from 'react-router-dom';
import { FiClock, FiX, FiArrowRight } from 'react-icons/fi';
import './PaymentRequestAlertPopup.css';

export default function PaymentRequestAlertPopup({ notification, onDismiss }) {
  const navigate = useNavigate();

  if (!notification) return null;

  const lines = (notification.message || '').split('\n').filter(Boolean);

  const handleReview = () => {
    onDismiss();
    navigate('/payment-requests');
  };

  return (
    <div className="pra-overlay" onClick={onDismiss}>
      <div className="pra-popup" role="alertdialog" aria-live="polite" onClick={e => e.stopPropagation()}>
        <button className="pra-close" onClick={onDismiss} aria-label="Dismiss">
          <FiX size={16} />
        </button>

        <div className="pra-icon-badge">
          <FiClock size={22} />
        </div>

        <h2 className="pra-title">{notification.title}</h2>

        <div className="pra-body">
          {lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>

        <button className="btn pra-review-btn" onClick={handleReview}>
          Review Now <FiArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
