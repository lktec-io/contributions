import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSmsMode } from '../hooks/useSmsMode';
import LoadingSpinner from '../components/common/LoadingSpinner';

/*  blockCustomSms — for contribution/payment pages a Custom SMS account must
    not reach, including by typing the URL. The API rejects those accounts too;
    this only keeps the UI honest.                                            */
export default function ProtectedRoute({ children, blockCustomSms = false }) {
  const { user, loading } = useContext(AuthContext);
  const smsMode = useSmsMode(blockCustomSms && !loading && !!user);

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;

  if (blockCustomSms) {
    if (smsMode === null) return <LoadingSpinner fullPage />;
    if (smsMode === 'custom') return <Navigate to="/contributions" replace />;
  }

  return children;
}
