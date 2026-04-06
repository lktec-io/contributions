import { useState, useEffect, useContext } from 'react';
import {
  FiCalendar, FiUsers, FiDollarSign, FiCheckCircle,
  FiAlertCircle, FiAlertTriangle,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import Footer from '../common/Footer';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import ClientEvents from './ClientEvents';
import ClientContributions from './ClientContributions';
import './ClientDashboard.css';

const CLIENT_STATS = [
  { key: 'myEvents',       label: 'My Events',     Icon: FiCalendar,    color: '#A78BFA' },
  { key: 'myContributors', label: 'Contributors',  Icon: FiUsers,       color: '#3B82F6' },
  { key: 'totalPledged',   label: 'Total Pledged', Icon: FiDollarSign,  color: '#FFA500', money: true },
  { key: 'totalPaid',      label: 'Total Paid',    Icon: FiCheckCircle, color: '#00B894', money: true },
  { key: 'outstanding',    label: 'Outstanding',   Icon: FiAlertCircle, color: '#FF4C4C', money: true },
];

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
        <FiAlertTriangle size={36} color="var(--accent-orange)" />
        <p>{error}</p>
        <button className="btn" onClick={fetchStats}>Retry</button>
      </div>
    );

    return (
      <>
        <div className="welcome-banner">
          <div className="welcome-banner-inner">
            <div className="welcome-text">
              <h1>Welcome back, {user?.name}!</h1>
              <p>{today}</p>
            </div>
          </div>
        </div>

        <div className="stats-grid stats-grid-5">
          {CLIENT_STATS.map(({ key, label, Icon, color, money }) => (
            <div key={key} className="stat-card">
              <div className="stat-icon-wrap" style={{ background: `${color}1F` }}>
                <Icon size={24} color={color} />
              </div>
              <div className="stat-info">
                <span className="stat-label">{label}</span>
                <span className="stat-value" style={money ? { color, fontSize: '17px' } : {}}>
                  {money ? formatCurrency(stats?.[key] ?? 0) : (stats?.[key] ?? 0)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="section-card">
          <h2 className="section-title">Recent Contributions</h2>
          {!stats?.recentContributions?.length ? (
            <EmptyState
              IconComponent={FiDollarSign}
              title="No contributions yet"
              description="Contributions will appear here once added."
            />
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
        <Footer />
      </div>
    </div>
  );
}
