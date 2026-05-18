import { useContext } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './NotFound.css';

export default function NotFound() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Authenticated users landing on an unknown path go straight to dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="not-found">
      <div className="not-found-content">
        <span className="not-found-code">404</span>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">The page you are looking for does not exist or has been moved.</p>
        <button className="btn" onClick={() => navigate('/login')}>
          Go to Login
        </button>
      </div>
    </div>
  );
}
