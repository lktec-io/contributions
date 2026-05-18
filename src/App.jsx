'use strict';
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

  const isAdmin = authCtx.user?.role === 'super_admin' || authCtx.user?.role === 'admin';

  // The shared layout component for the current user's role.
  // All internal tab-paths render the same shell; the shell reads the URL
  // to decide which tab content to display.
  const dashboardEl = (
    <ProtectedRoute>
      {isAdmin ? <AdminDashboard /> : <ClientDashboard />}
    </ProtectedRoute>
  );

  // Admin-only paths redirect non-admin users to /dashboard
  const adminOnlyEl = (
    <ProtectedRoute>
      {isAdmin
        ? <AdminDashboard />
        : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );

  return (
    <Routes>
      {/* ── Public (unauthenticated) routes ───────────────── */}
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

      {/* ── Internal tab routes (SPA — no page reload) ────── */}
      <Route path="/dashboard"    element={dashboardEl} />
      <Route path="/events"       element={dashboardEl} />
      <Route path="/contributions" element={dashboardEl} />

      {/* Admin-only tab routes */}
      <Route path="/users"  element={adminOnlyEl} />
      <Route path="/admins" element={adminOnlyEl} />

      {/* ── Standalone protected pages ─────────────────────── */}
      <Route
        path="/settings"
        element={<ProtectedRoute><Settings /></ProtectedRoute>}
      />
      <Route
        path="/hidden-records"
        element={<ProtectedRoute><HiddenRecords /></ProtectedRoute>}
      />

      {/* ── Root redirect ──────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* ── Unknown routes ─────────────────────────────────── */}
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
