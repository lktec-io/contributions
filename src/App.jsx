import { useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { setAuthContext } from './services/api';
import ProtectedRoute from './routes/ProtectedRoute';
import ThemeWaveOverlay from './components/common/ThemeWaveOverlay';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import HiddenRecords from './pages/HiddenRecords';
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
        path="/forgot-password"
        element={authCtx.user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={authCtx.user ? <Navigate to="/dashboard" replace /> : <ResetPassword />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {(authCtx.user?.role === 'super_admin' || authCtx.user?.role === 'admin')
              ? <AdminDashboard />
              : <ClientDashboard />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hidden-records"
        element={
          <ProtectedRoute>
            <HiddenRecords />
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
      <ThemeWaveOverlay />
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
