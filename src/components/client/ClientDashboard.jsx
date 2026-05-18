import { useState, useEffect, useContext } from 'react';
import {
  FiCalendar, FiUsers, FiDollarSign, FiCheckCircle,
  FiAlertCircle, FiAlertTriangle, FiRefreshCw, FiEye,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import Footer from '../common/Footer';
import WelcomePopup from '../common/WelcomePopup';
import { StatsSkeleton } from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import ClientEvents from './ClientEvents';
import ClientContributions from './ClientContributions';
import PieChartCard from '../common/PieChartCard';
import './ClientDashboard.css';

const CLIENT_STATS = [
  { key: 'myEvents',       label: 'My Events',     Icon: FiCalendar,    color: '#A78BFA' },
  { key: 'myContributors', label: 'Assignments',   Icon: FiUsers,       color: '#3B82F6' },
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Welcome popup — shown once per login session
  const [showWelcome, setShowWelcome] = useState(() => {
    const name = sessionStorage.getItem('justLoggedIn');
    if (name) { sessionStorage.removeItem('justLoggedIn'); return name; }
    return null;
  });

  useEffect(() => {
    if (activeTab === 'dashboard') fetchStats();
  }, [activeTab]);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/client');
      setStats(res.data.data);
      if (isRefresh) toast.success('Dashboard refreshed');
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5  && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  const renderDashboardTab = () => {
    if (loading) return (
      <>
        <div className="welcome-banner welcome-banner-skeleton">
          <div className="welcome-banner-inner" style={{ gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ width: 240, height: 24, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 160, height: 13, borderRadius: 4 }} />
            </div>
          </div>
        </div>
        <StatsSkeleton count={5} />
        <PieChartCard loading />
      </>
    );
    if (error) return (
      <div className="error-state">
        <FiAlertTriangle size={36} color="var(--accent-orange)" />
        <p>{error}</p>
        <button className="btn" onClick={() => fetchStats()}>Retry</button>
      </div>
    );

    return (
      <>
        <div className="welcome-banner">
          <div className="welcome-banner-inner">
            <div className="welcome-text">
              <h1>Welcome Back, {getGreeting()} <span>{user?.name}</span>!</h1>
              <p>{today}</p>
            </div>
            <div className="welcome-banner-btns">
              <button
                className="btn btn-secondary btn-view-contribs"
                onClick={() => setActiveTab('contributions')}
                title="View all contributors"
              >
                <FiEye size={15} /> View Contributors
              </button>
              <button
                className="btn btn-refresh"
                onClick={() => fetchStats(true)}
                disabled={refreshing}
                title="Refresh dashboard data"
              >
                <FiRefreshCw size={15} className={refreshing ? 'spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh Data'}
              </button>
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

        <div className="dashboard-bottom-grid">
          <PieChartCard chartData={stats?.chartData} loading={false} />

          <div className="section-card">
            <h2 className="section-title">Recent Contributions</h2>
            {!stats?.recentContributions?.length ? (
              <EmptyState
                IconComponent={FiDollarSign}
                title="No contributions yet"
                description="Contributions will appear here once added."
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="table-wrap activity-table-wrap">
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

                {/* Mobile card list */}
                <div className="activity-card-list">
                  {stats.recentContributions.map(c => (
                    <div key={c.id} className="activity-card">
                      <div className="ac-row ac-top">
                        <span className="ac-name">{c.contributor_name}</span>
                        <span className={getStatusBadgeClass(c.status)}>{c.status}</span>
                      </div>
                      <div className="ac-row ac-mid">
                        <span className="ac-event">{c.event_name}</span>
                        <span className="ac-date">{formatDate(c.created_at)}</span>
                      </div>
                      <div className="ac-row">
                        <span className="ac-amount">{formatCurrency(c.paid_amount)}</span>
                        <span className="ac-pledged">of {formatCurrency(c.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
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
        <Header
          onMenuToggle={() => setSidebarOpen(prev => !prev)}
          menuOpen={sidebarOpen}
        />
        <main className="main-content">{renderContent()}</main>
        <Footer />
      </div>

      {showWelcome && (
        <WelcomePopup name={showWelcome} onDismiss={() => setShowWelcome(null)} />
      )}
    </div>
  );
}
