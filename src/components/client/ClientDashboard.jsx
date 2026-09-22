import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiCalendar, FiUsers, FiDollarSign, FiCheckCircle,
  FiAlertCircle, FiAlertTriangle, FiRefreshCw, FiEye,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import { BrandingContext } from '../../context/BrandingContext';
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
import CustomSmsMembers from './CustomSmsMembers';
import './ClientLedger.css';
import CustomSmsDashboard from './CustomSmsDashboard';
import { useSmsMode } from '../../hooks/useSmsMode';
import PieChartCard from '../common/PieChartCard';
import './ClientDashboard.css';

const CLIENT_STATS = [
  { key: 'myEvents',       label: 'My Events',     Icon: FiCalendar,    color: '#A78BFA', to: '/events' },
  { key: 'myContributors', label: 'Assignments',   Icon: FiUsers,       color: '#3B82F6', to: '/contributions' },
  { key: 'totalPledged',   label: 'Jumla ya Michango ya Vikundi', Icon: FiDollarSign,  color: '#B8730B', money: true, to: '/contributions' },
  { key: 'totalPaid',      label: 'Kiasi Kilicholipwa',           Icon: FiCheckCircle, color: '#198754', money: true, to: '/contributions' },
  { key: 'outstanding',    label: 'Mizani Inayodaiwa',            Icon: FiAlertCircle, color: '#B42318', money: true, to: '/contributions' },
];

// Maps URL paths to client tab IDs
function tabFromPath(pathname) {
  switch (pathname) {
    case '/events':        return 'events';
    case '/contributions': return 'contributions';
    default:               return 'dashboard';
  }
}

export default function ClientDashboard() {
  const { user } = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const { logoUrl } = useContext(BrandingContext);
  const navigate  = useNavigate();
  const location  = useLocation();
  const activeTab = tabFromPath(location.pathname);
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

  // A Custom SMS account is a communication workspace, not a contribution one:
  // it gets the member list instead of contributors, and no financial figures.
  // Resolved from the existing SMS status endpoint — no new route.
  const smsMode = useSmsMode();
  const isCustomSms = smsMode === 'custom';

  useEffect(() => {
    // A Custom SMS account has no financial dashboard and the stats endpoint
    // now rejects it, so don't call it at all.
    if (smsMode === null || isCustomSms) return;
    if (activeTab === 'dashboard') fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, smsMode]);

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

    /* Ledger maths — derived entirely from figures already in `stats`.
       No new fetch, no estimate: pledged is the goal, paid is against it. */
    const pledged     = Number(stats?.totalPledged ?? 0);
    const paid        = Number(stats?.totalPaid ?? 0);
    const outstanding = Number(stats?.outstanding ?? 0);
    const collectedPct = pledged > 0 ? Math.min(100, Math.round((paid / pledged) * 100)) : 0;
    const owedPct      = pledged > 0 ? Math.max(0, 100 - collectedPct) : 0;

    const ledgerRows = [
      {
        key: 'pledged',
        term: 'Jumla ya Michango ya Vikundi',
        gloss: 'Total pledged — the goal',
        value: pledged,
        share: pledged > 0 ? 100 : 0,
        tone: 'neutral',
      },
      {
        key: 'paid',
        term: 'Kiasi Kilicholipwa',
        gloss: 'Collected to date',
        value: paid,
        share: collectedPct,
        tone: 'good',
      },
      {
        key: 'outstanding',
        term: 'Mizani Inayodaiwa',
        gloss: 'Still owed',
        value: outstanding,
        share: owedPct,
        tone: 'owed',
      },
    ];

    return (
      <>
        <div className="welcome-banner">
          <div className="welcome-banner-inner">
            <div className="welcome-banner-identity">
              {logoUrl && <img src={logoUrl} alt="" className="welcome-banner-logo" />}
              <div className="welcome-text">
                <h1>Welcome Back, {getGreeting()} <span>{user?.name}</span>!</h1>
                <p>{today}</p>
              </div>
            </div>
            <div className="welcome-banner-btns">
              <button
                className="btn btn-secondary btn-view-contribs"
                onClick={() => navigate('/contributions')}
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

        {/* ══════════════════════════════════════════
            LEDGER INTELLIGENCE — collection posture
            ══════════════════════════════════════════ */}
        <section className="fl" aria-label="Collection posture">
          <header className="fl-head">
            <div className="fl-head-copy">
              <p className="fl-eyebrow">Ledger intelligence</p>
              <h2 className="fl-title">Collection posture</h2>
            </div>
            <button
              type="button"
              className="fl-head-link"
              onClick={() => navigate('/contributions')}
            >
              Open ledger
            </button>
          </header>

          <div className="fl-grid">
            {/* Percentage ring — pure CSS conic gradient */}
            <article className="fl-ring-card">
              <div
                className="fl-ring"
                style={{ '--pct': collectedPct }}
                role="img"
                aria-label={`${collectedPct}% of pledged contributions collected`}
              >
                <div className="fl-ring-hole">
                  <span className="fl-ring-pct">{collectedPct}<i>%</i></span>
                  <span className="fl-ring-cap">Collected</span>
                </div>
              </div>

              <dl className="fl-legend">
                <div className="fl-legend-row">
                  <dt className="fl-legend-term"><i className="fl-dot fl-dot--good" />Kiasi Kilicholipwa</dt>
                  <dd className="fl-legend-val">{collectedPct}%</dd>
                </div>
                <div className="fl-legend-row">
                  <dt className="fl-legend-term"><i className="fl-dot fl-dot--owed" />Mizani Inayodaiwa</dt>
                  <dd className="fl-legend-val">{owedPct}%</dd>
                </div>
              </dl>
            </article>

            {/* Weighted comparison rows */}
            <article className="fl-rows">
              {ledgerRows.map(r => (
                <div className={`fl-row fl-row--${r.tone}`} key={r.key}>
                  <div className="fl-row-id">
                    <span className="fl-row-term">{r.term}</span>
                    <span className="fl-row-gloss">{r.gloss}</span>
                  </div>
                  <span className="fl-row-value">{formatCurrency(r.value)}</span>
                  <span className="fl-row-share">{r.share}%</span>
                  <span className="fl-row-track" aria-hidden="true">
                    <i className="fl-row-fill" style={{ width: `${r.share}%` }} />
                  </span>
                </div>
              ))}
            </article>
          </div>

          {/* Counters stay one tap from the ledger */}
          <div className="fl-counters">
            {CLIENT_STATS.filter(s => !s.money).map(({ key, label, Icon, to }) => (
              <button
                type="button"
                key={key}
                className="fl-counter"
                onClick={() => navigate(to)}
                title={`Go to ${label}`}
              >
                <span className="fl-counter-icon"><Icon size={16} /></span>
                <span className="fl-counter-body">
                  <span className="fl-counter-label">{label}</span>
                  <span className="fl-counter-value">{stats?.[key] ?? 0}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

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
    // Wait for the mode before rendering either workspace, so a Custom SMS user
    // never sees a flash of the contribution/financial UI.
    if (smsMode === null) return <StatsSkeleton />;

    // A Custom SMS account gets its own communication workspace. No
    // contribution or event-amount screen is reachable, by tab or by URL.
    if (isCustomSms) {
      return activeTab === 'contributions'
        ? <CustomSmsMembers />
        : <CustomSmsDashboard />;
    }

    switch (activeTab) {
      case 'events':        return <ClientEvents onViewContributions={() => navigate('/contributions')} />;
      case 'contributions': return <ClientContributions />;
      default:              return renderDashboardTab();
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        smsMode={smsMode}
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
