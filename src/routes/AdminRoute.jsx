import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function AdminRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin' && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
