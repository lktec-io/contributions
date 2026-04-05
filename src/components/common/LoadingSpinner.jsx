import './LoadingSpinner.css';

export default function LoadingSpinner({ size = 'medium', fullPage = false }) {
  if (fullPage) {
    return (
      <div className="spinner-overlay">
        <div className={`spinner spinner-${size}`} />
      </div>
    );
  }
  return <div className={`spinner spinner-${size}`} />;
}
