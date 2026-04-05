import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import ClientEvents from './ClientEvents';
import ClientContributions from './ClientContributions';
import './ClientDashboard.css';

export default function ClientDashboard() {
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
      const res = await api.get('/dashboard/client');
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
          <span className="welcome-emoji">💰</span>
        </div>

        <div className="stats-grid stats-grid-5">
          <div className="stat-card">
            <span className="stat-icon">🎉</span>
            <div className="stat-info">
              <span className="stat-label">My Events</span>
              <span className="stat-value">{stats?.myEvents ?? 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">👥</span>
            <div className="stat-info">
              <span className="stat-label">Contributors</span>
              <span className="stat-value">{stats?.myContributors ?? 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-info">
              <span className="stat-label">Total Pledged</span>
              <span className="stat-value stat-money">{formatCurrency(stats?.totalPledged ?? 0)}</span>
            </div>
          </div>
          <div className="stat-card stat-card-accent">
            <span className="stat-icon">✅</span>
            <div className="stat-info">
              <span className="stat-label">Total Paid</span>
              <span className="stat-value stat-money">{formatCurrency(stats?.totalPaid ?? 0)}</span>
            </div>
          </div>
          <div className="stat-card stat-card-warning">
            <span className="stat-icon">⏳</span>
            <div className="stat-info">
              <span className="stat-label">Outstanding</span>
              <span className="stat-value stat-money-warning">{formatCurrency(stats?.outstanding ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="section-card">
          <h2 className="section-title">Recent Contributions</h2>
          {!stats?.recentContributions?.length ? (
            <EmptyState icon="📋" title="No contributions yet" description="Contributions will appear here once added." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contributor</th>
                    <th>Event</th>
                    <th>Pledged</th>
                    <th>Paid</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentContributions.map(c => (
                    <tr key={c.id}>
                      <td className="td-name">{c.contributor_name}</td>
                      <td>{c.event_name}</td>
                      <td className="td-money">{formatCurrency(c.amount)}</td>
                      <td className="td-money td-paid">{formatCurrency(c.paid_amount)}</td>
                      <td><span className={getStatusBadgeClass(c.status)}>{c.status}</span></td>
                      <td className="td-date">{formatDate(c.created_at)}</td>
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
      case 'events':        return <ClientEvents onViewContributions={() => setActiveTab('contributions')} />;
      case 'contributions': return <ClientContributions />;
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
