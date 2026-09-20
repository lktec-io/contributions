import { useContext, useEffect, useMemo, useState } from 'react';
import {
  FiBell, FiCheck, FiCheckCircle, FiTrash2, FiSearch, FiRefreshCw,
  FiMessageSquare, FiCalendar, FiDollarSign, FiInbox,
} from 'react-icons/fi';
import { ToastContext } from '../context/ToastContext';
import { notificationService } from '../services/notificationService';
import { getErrorMessage } from '../utils/helpers';
import { useSmsMode } from '../hooks/useSmsMode';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import SearchableSelect from '../components/common/SearchableSelect';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import './NotificationsRoom.css';

/* Channel presentation per notification type. Types come from the server
   (Notification.create defaults to 'system'); anything unmapped falls back. */
const CHANNELS = {
  sms:      { label: 'SMS',      Icon: FiMessageSquare, tone: 'emerald' },
  payment:  { label: 'Payment',  Icon: FiDollarSign,    tone: 'gold'    },
  event:    { label: 'Event',    Icon: FiCalendar,      tone: 'slate'   },
  reminder: { label: 'Reminder', Icon: FiBell,          tone: 'gold'    },
  system:   { label: 'System',   Icon: FiInbox,         tone: 'slate'   },
};

const channelOf = (type) => CHANNELS[type] || CHANNELS.system;

/* Tanzania is UTC+3 year-round; render every stamp in that zone so the ledger
   reads the same for every operator regardless of device timezone. */
const TZ = 'Africa/Dar_es_Salaam';

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

const isToday = (date) => dayFmt.format(date) === dayFmt.format(new Date());

export default function NotificationsRoom() {
  const { toast } = useContext(ToastContext);
  const smsMode = useSmsMode();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(false);

  const [query,   setQuery]   = useState('');
  const [channel, setChannel] = useState('all');
  const [state,   setState]   = useState('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationService.getAll();
      setItems(res.data.data || []);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const unread = items.filter(n => !n.is_read).length;
  const todayCount = items.filter(n => isToday(new Date(n.created_at))).length;

  const channelOptions = useMemo(() => {
    const present = [...new Set(items.map(n => n.type || 'system'))];
    return [
      { value: 'all', label: 'All channels' },
      ...present.map(t => ({ value: t, label: channelOf(t).label })),
    ];
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(n => {
      const matchesChannel = channel === 'all' || (n.type || 'system') === channel;
      const matchesState =
        state === 'all' || (state === 'unread' ? !n.is_read : !!n.is_read);
      const matchesQuery =
        !q ||
        String(n.title || '').toLowerCase().includes(q) ||
        String(n.message || '').toLowerCase().includes(q);
      return matchesChannel && matchesState && matchesQuery;
    });
  }, [items, query, channel, state]);

  const markOne = async (n) => {
    if (n.is_read) return;
    setItems(cur => cur.map(x => (x.id === n.id ? { ...x, is_read: 1 } : x)));
    try {
      await notificationService.markRead(n.id);
    } catch (err) {
      setItems(cur => cur.map(x => (x.id === n.id ? { ...x, is_read: 0 } : x)));
      toast.error(getErrorMessage(err));
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationService.markAllRead();
      setItems(cur => cur.map(x => ({ ...x, is_read: 1 })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (n) => {
    const snapshot = items;
    setItems(cur => cur.filter(x => x.id !== n.id));
    try {
      await notificationService.deleteOne(n.id);
    } catch (err) {
      setItems(snapshot);
      toast.error(getErrorMessage(err));
    }
  };

  const clearAll = async () => {
    setBusy(true);
    try {
      await notificationService.deleteAll();
      setItems([]);
      setConfirmClear(false);
      toast.success('Notification log cleared');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
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
          onMenuToggle={() => setSidebarOpen(o => !o)}
          menuOpen={sidebarOpen}
        />

        <main className="main-content">
          <div className="nr">

      {/* ── Page head ─────────────────────────────── */}
      <header className="nr-head">
        <div className="nr-head-copy">
          <p className="nr-eyebrow">Communication</p>
          <h2 className="nr-title">Notifications Room</h2>
          <p className="nr-sub">Every outgoing alert and system message, newest first.</p>
        </div>

        <div className="nr-head-actions">
          <button className="nr-btn" onClick={load} disabled={loading || busy}>
            <FiRefreshCw size={14} className={loading ? 'nr-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="nr-btn" onClick={markAll} disabled={busy || unread === 0}>
            <FiCheckCircle size={14} />
            <span>Mark all read</span>
          </button>
          <button
            className="nr-btn nr-btn-danger"
            onClick={() => setConfirmClear(true)}
            disabled={busy || items.length === 0}
          >
            <FiTrash2 size={14} />
            <span>Clear log</span>
          </button>
        </div>
      </header>

      {/* ── Ledger summary ────────────────────────── */}
      <section className="nr-stats" aria-label="Notification summary">
        <article className="nr-stat">
          <span className="nr-stat-label">Total in log</span>
          <span className="nr-stat-value">{items.length}</span>
        </article>
        <article className="nr-stat nr-stat--accent">
          <span className="nr-stat-label">Unread</span>
          <span className="nr-stat-value">{unread}</span>
        </article>
        <article className="nr-stat">
          <span className="nr-stat-label">Today</span>
          <span className="nr-stat-value">{todayCount}</span>
        </article>
      </section>

      {/* ── Ledger ────────────────────────────────── */}
      <section className="nr-panel">
        <div className="nr-toolbar">
          <div className="nr-search">
            <FiSearch size={14} className="nr-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="nr-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search recipient or message…"
              aria-label="Search notifications"
            />
          </div>

          <div className="nr-filter">
            <SearchableSelect
              value={channel}
              onChange={setChannel}
              aria-label="Filter by channel"
              options={channelOptions}
            />
          </div>

          <div className="nr-filter">
            <SearchableSelect
              value={state}
              onChange={setState}
              aria-label="Filter by read state"
              options={[
                { value: 'all',    label: 'All states' },
                { value: 'unread', label: 'Unread'     },
                { value: 'read',   label: 'Read'       },
              ]}
            />
          </div>

          <span className="nr-count">{rows.length} of {items.length}</span>
        </div>

        {loading ? (
          <div className="nr-loading"><LoadingSpinner size="large" /></div>
        ) : error ? (
          <div className="nr-empty">
            <span className="nr-empty-title">Could not load notifications</span>
            <span className="nr-empty-text">{error}</span>
            <button className="nr-btn" onClick={load}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="nr-empty">
            <span className="nr-empty-icon"><FiBell size={20} /></span>
            <span className="nr-empty-title">
              {items.length === 0 ? 'No notifications yet' : 'Nothing matches these filters'}
            </span>
            <span className="nr-empty-text">
              {items.length === 0
                ? 'Alerts appear here as messages are sent and events are recorded.'
                : 'Try a different channel, state or search term.'}
            </span>
          </div>
        ) : (
          <ul className="nr-list">
            {rows.map(n => {
              const ch = channelOf(n.type || 'system');
              const when = new Date(n.created_at);
              return (
                <li key={n.id} className={`nr-row${n.is_read ? '' : ' is-unread'}`}>
                  <span className={`nr-channel nr-channel--${ch.tone}`}>
                    <ch.Icon size={12} aria-hidden="true" />
                    <span className="nr-channel-label">{ch.label}</span>
                  </span>

                  <div className="nr-body">
                    <span className="nr-row-title">{n.title}</span>
                    <span className="nr-row-message">{n.message}</span>
                  </div>

                  <div className="nr-when">
                    <span className="nr-when-date">{dayFmt.format(when)}</span>
                    <span className="nr-when-time">{timeFmt.format(when)}</span>
                  </div>

                  <div className="nr-row-actions">
                    {!n.is_read && (
                      <button
                        className="nr-icon-btn"
                        onClick={() => markOne(n)}
                        title="Mark as read"
                        aria-label={`Mark "${n.title}" as read`}
                      >
                        <FiCheck size={14} />
                      </button>
                    )}
                    <button
                      className="nr-icon-btn nr-icon-danger"
                      onClick={() => removeOne(n)}
                      title="Delete"
                      aria-label={`Delete "${n.title}"`}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={confirmClear}
        title="Clear the notification log?"
        message="Every notification in this list is permanently removed. Messages already sent are not affected."
        confirmText="Clear log"
        confirmVariant="danger"
        onConfirm={clearAll}
        onClose={() => setConfirmClear(false)}
        loading={busy}
      />
          </div>
        </main>
      </div>
    </div>
  );
}
