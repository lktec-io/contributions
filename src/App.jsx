import { useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { setAuthContext } from './services/api';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import AdminDashboard from './components/admin/AdminDashboard';
import ClientDashboard from './components/client/ClientDashboard';
import ToastContainer from './components/common/Toast';
import LoadingSpinner from './components/common/LoadingSpinner';
import './App.css';

function AppRoutes() {
  const authCtx = useContext(AuthContext);

  useEffect(() => {
    setAuthContext(authCtx);
  }, [authCtx]);

  if (authCtx.loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authCtx.user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {authCtx.user?.role === 'super_admin' ? <AdminDashboard /> : <ClientDashboard />}
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
            <ToastContainer />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
