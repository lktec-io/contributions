import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import UserManagement from './UserManagement';
import AdminEvents from './AdminEvents';
import AdminContributions from './AdminContributions';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchStats();
  }, [activeTab]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/admin');
      setStats(res.data.data);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const renderDashboardTab = () => {
    if (loading) return <div className="tab-loading"><LoadingSpinner size="large" /></div>;
    if (error) return (
      <div className="error-state">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
        <button className="btn" onClick={fetchStats}>Retry</button>
      </div>
    );

    return (
      <>
        <div className="welcome-banner">
          <div className="welcome-text">
            <h1>Welcome back, {user?.name} 👋</h1>
            <p>{today}</p>
          </div>
          <span className="welcome-emoji">📊</span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">👥</span>
            <div className="stat-info">
              <span className="stat-label">Total Users</span>
              <span className="stat-value">{stats?.totalUsers ?? 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎉</span>
            <div className="stat-info">
              <span className="stat-label">Total Events</span>
              <span className="stat-value">{stats?.totalEvents ?? 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-info">
              <span className="stat-label">Contributions</span>
              <span className="stat-value">{stats?.totalContributions ?? 0}</span>
            </div>
          </div>
          <div className="stat-card stat-card-accent">
            <span className="stat-icon">✅</span>
            <div className="stat-info">
              <span className="stat-label">Total Collected</span>
              <span className="stat-value stat-money">{formatCurrency(stats?.totalCollected ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="section-card">
          <h2 className="section-title">Recent Activity</h2>
          {!stats?.recentActivity?.length ? (
            <EmptyState icon="📋" title="No activity yet" description="Contributions will appear here as they are added." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contributor</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map(item => (
                    <tr key={item.id}>
                      <td className="td-name">{item.contributor_name}</td>
                      <td>{item.event_name}</td>
                      <td className="td-money">{formatCurrency(item.amount)}</td>
                      <td><span className={`status-badge badge-${item.status}`}>{item.status}</span></td>
                      <td className="td-date">{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':         return <UserManagement />;
      case 'events':        return <AdminEvents />;
      case 'contributions': return <AdminContributions />;
      default:              return renderDashboardTab();
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-area">
        <Header onMenuToggle={() => setSidebarOpen(prev => !prev)} />
        <main className="main-content">{renderContent()}</main>
      </div>
    </div>
  );
}
