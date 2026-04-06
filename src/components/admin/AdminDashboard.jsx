import { useState, useEffect, useContext } from 'react';
import {
  FiUsers, FiCalendar, FiDollarSign, FiCheckCircle,
  FiAlertTriangle,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import Footer from '../common/Footer';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import UserManagement from './UserManagement';
import AdminEvents from './AdminEvents';
import AdminContributions from './AdminContributions';
import './AdminDashboard.css';

const STAT_CARDS = [
  { key: 'totalUsers',         label: 'Total Users',         Icon: FiUsers,        color: '#3B82F6' },
  { key: 'totalEvents',        label: 'Total Events',        Icon: FiCalendar,     color: '#A78BFA' },
  { key: 'totalContributions', label: 'Contributions',       Icon: FiDollarSign,   color: '#FFA500' },
  { key: 'totalCollected',     label: 'Total Collected',     Icon: FiCheckCircle,  color: '#00B894', money: true },
];

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
              <h1>Welcome back, {user?.name} 👋</h1>
              <p>{today}</p>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          {STAT_CARDS.map(({ key, label, Icon, color, money }) => (
            <div key={key} className="stat-card">
              <div className="stat-icon-wrap" style={{ background: `${color}1F` }}>
                <Icon size={24} color={color} />
              </div>
              <div className="stat-info">
                <span className="stat-label">{label}</span>
                <span className="stat-value" style={money ? { color } : {}}>
                  {money ? formatCurrency(stats?.[key] ?? 0) : (stats?.[key] ?? 0)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="section-card">
          <h2 className="section-title">Recent Activity</h2>
          {!stats?.recentActivity?.length ? (
            <EmptyState
              IconComponent={FiDollarSign}
              title="No activity yet"
              description="Contributions will appear here as they are added."
            />
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
        <Footer />
      </div>
    </div>
  );
}
