import './SuccessToast.css';

export default function SuccessToast({ message, show }) {
  return (
    <div className={`success-toast ${show ? 'show' : ''}`} aria-live="polite">
      {message}
    </div>
  );
}
