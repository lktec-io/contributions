import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiMessageSquare, FiSearch, FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiXCircle, FiCalendar, FiX,
} from 'react-icons/fi';
import { ToastContext } from '../context/ToastContext';
import { smsHistoryService } from '../services/smsHistoryService';
import { getErrorMessage, debounce } from '../utils/helpers';
import { useSmsMode } from '../hooks/useSmsMode';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import SearchableSelect from '../components/common/SearchableSelect';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import './SmsLogs.css';

/*  Read-only report over sms_history. Search, filtering and pagination all
    happen on the server — only one page of rows is ever fetched.           */

const PAGE_SIZE = 20;

/* The vocabulary written by the send paths. Labels only; no new rules. */
const TYPE_LABELS = {
  custom_member:          'Custom SMS — one member',
  custom_campaign_member: 'Custom SMS — Send to All',
  custom:                 'Dispatch to All — custom',
  bulk:                   'Dispatch to All — reminder',
  reminder:               'Payment reminder',
};

const typeLabel = (t) => TYPE_LABELS[t] || t || '—';

const TZ = 'Africa/Dar_es_Salaam';
const dayFmt  = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

export default function SmsLogs() {
  const { toast } = useContext(ToastContext);
  const smsMode = useSmsMode();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [logs,    setLogs]    = useState([]);
  const [stats,   setStats]   = useState(null);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [type,     setType]     = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');

  const [detail,        setDetail]        = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // The query actually sent to the server. Search is debounced into it so a
  // keystroke does not become a request.
  const [appliedSearch, setAppliedSearch] = useState('');

  const pushSearch = useRef(debounce((v) => { setAppliedSearch(v); setPage(1); }, 300)).current;

  const onSearchChange = (v) => {
    setSearch(v);
    pushSearch(v);
  };

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (appliedSearch) p.search = appliedSearch;
    if (status) p.status = status;
    if (type)   p.type   = type;
    if (from)   p.from   = from;
    if (to)     p.to     = to;
    return p;
  }, [page, appliedSearch, status, type, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, sumRes] = await Promise.all([
        smsHistoryService.list(params),
        smsHistoryService.summary(params),
      ]);
      const d = listRes.data.data;
      setLogs(d.logs || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setStats(sumRes.data.data || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (row) => {
    setDetailLoading(true);
    setDetail({ id: row.id });           // opens the modal immediately
    try {
      const res = await smsHistoryService.getById(row.id);
      setDetail(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setAppliedSearch('');
    setStatus(''); setType(''); setFrom(''); setTo('');
    setPage(1);
  };

  const hasFilters = !!(appliedSearch || status || type || from || to);

  const typeOptions = useMemo(() => ([
    { value: '', label: 'All types' },
    ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
  ]), []);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        smsMode={smsMode}
      />

      <div className="main-area">
        <Header onMenuToggle={() => setSidebarOpen(o => !o)} menuOpen={sidebarOpen} />

        <main className="main-content">
          <div className="sl">

            {/* ── Head ───────────────────────────── */}
            <header className="sl-head">
              <div className="sl-head-copy">
                <p className="sl-eyebrow">Reporting</p>
                <h2 className="sl-title">SMS Logs</h2>
                <p className="sl-sub">Delivery history for every message this account has sent.</p>
              </div>
              <button className="sl-btn" onClick={load} disabled={loading}>
                <FiRefreshCw size={14} className={loading ? 'sl-spin' : ''} />
                <span>Refresh</span>
              </button>
            </header>

            {/* ── Summary ────────────────────────── */}
            <section className="sl-stats" aria-label="SMS summary">
              <article className="sl-stat">
                <span className="sl-stat-label">Total SMS</span>
                <span className="sl-stat-value">{stats ? stats.total : '—'}</span>
              </article>
              <article className="sl-stat sl-stat--sent">
                <span className="sl-stat-label">Sent</span>
                <span className="sl-stat-value">{stats ? stats.sent : '—'}</span>
              </article>
              <article className="sl-stat sl-stat--failed">
                <span className="sl-stat-label">Failed</span>
                <span className="sl-stat-value">{stats ? stats.failed : '—'}</span>
              </article>
              <article className="sl-stat">
                <span className="sl-stat-label">Today</span>
                <span className="sl-stat-value">{stats ? stats.today : '—'}</span>
              </article>
              <article className="sl-stat">
                <span className="sl-stat-label">Last 7 days</span>
                <span className="sl-stat-value">{stats ? stats.last7 : '—'}</span>
              </article>
            </section>

            {/* ── Panel ──────────────────────────── */}
            <section className="sl-panel">
              <div className="sl-toolbar">
                <div className="sl-search">
                  <FiSearch size={14} className="sl-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    className="sl-search-input"
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Search name, phone, event, message or error…"
                    aria-label="Search SMS logs"
                  />
                </div>

                <div className="sl-filter">
                  <SearchableSelect
                    value={status}
                    onChange={(v) => { setStatus(v); setPage(1); }}
                    aria-label="Filter by status"
                    options={[
                      { value: '',       label: 'All statuses' },
                      { value: 'sent',   label: 'Sent' },
                      { value: 'failed', label: 'Failed' },
                    ]}
                  />
                </div>

                <div className="sl-filter sl-filter--wide">
                  <SearchableSelect
                    value={type}
                    onChange={(v) => { setType(v); setPage(1); }}
                    aria-label="Filter by SMS type"
                    options={typeOptions}
                  />
                </div>

                <div className="sl-dates">
                  <label className="sl-date">
                    <FiCalendar size={13} aria-hidden="true" />
                    <input
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={e => { setFrom(e.target.value); setPage(1); }}
                      aria-label="From date"
                    />
                  </label>
                  <span className="sl-date-sep" aria-hidden="true">–</span>
                  <label className="sl-date">
                    <input
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={e => { setTo(e.target.value); setPage(1); }}
                      aria-label="To date"
                    />
                  </label>
                </div>

                {hasFilters && (
                  <button className="sl-btn sl-btn-clear" onClick={clearFilters}>
                    <FiX size={14} /> Clear
                  </button>
                )}

                <span className="sl-count">
                  {loading ? 'Loading…' : `${logs.length} of ${total}`}
                </span>
              </div>

              {loading ? (
                <div className="sl-skeleton"><TableSkeleton rows={6} cols={6} /></div>
              ) : error ? (
                <div className="sl-state">
                  <span className="sl-state-icon sl-state-icon--error"><FiAlertTriangle size={20} /></span>
                  <span className="sl-state-title">Could not load SMS logs</span>
                  <span className="sl-state-text">{error}</span>
                  <button className="sl-btn" onClick={load}>Try again</button>
                </div>
              ) : logs.length === 0 ? (
                <div className="sl-state">
                  <span className="sl-state-icon"><FiMessageSquare size={20} /></span>
                  <span className="sl-state-title">
                    {hasFilters ? 'No logs match these filters' : 'No SMS sent yet'}
                  </span>
                  <span className="sl-state-text">
                    {hasFilters
                      ? 'Try a different search term, status, type or date range.'
                      : 'Messages appear here as soon as the first SMS is sent from this account.'}
                  </span>
                  {hasFilters && (
                    <button className="sl-btn" onClick={clearFilters}>Clear filters</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="sl-table-wrap">
                    <table className="data-table data-table--stack sl-table">
                      <thead>
                        <tr>
                          <th>Date / Time</th>
                          <th>Recipient</th>
                          <th>Phone</th>
                          <th>Event</th>
                          <th>Type</th>
                          <th>Message</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(row => {
                          const when = new Date(row.created_at);
                          const failed = row.status === 'failed';
                          return (
                            <tr
                              key={row.id}
                              className="sl-row"
                              onClick={() => openDetail(row)}
                              tabIndex={0}
                              role="button"
                              aria-label={`Open SMS log for ${row.recipient_name || 'unknown recipient'}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(row); }
                              }}
                            >
                              <td className="td-name" data-label="Date / Time">
                                <span className="sl-when">
                                  <span className="sl-when-date">{dayFmt.format(when)}</span>
                                  <span className="sl-when-time">{timeFmt.format(when)}</span>
                                </span>
                              </td>
                              <td data-label="Recipient">{row.recipient_name || '—'}</td>
                              <td data-label="Phone" className="sl-mono">{row.phone || '—'}</td>
                              <td data-label="Event">{row.event_name || '—'}</td>
                              <td data-label="Type">
                                <span className="sl-type">{typeLabel(row.type)}</span>
                              </td>
                              <td data-label="Message" className="sl-msg">
                                {row.message_preview
                                  ? `${row.message_preview}${row.message_length > 140 ? '…' : ''}`
                                  : '—'}
                              </td>
                              <td data-label="Status">
                                <span className={`sl-badge ${failed ? 'sl-badge--failed' : 'sl-badge--sent'}`}>
                                  {failed ? <FiXCircle size={12} /> : <FiCheckCircle size={12} />}
                                  {failed ? 'Failed' : 'Sent'}
                                </span>
                                {failed && row.error_preview && (
                                  <span className="sl-error-preview">{row.error_preview}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <nav className="sl-pager" aria-label="SMS log pages">
                    <button
                      className="sl-page"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      ‹ <span className="sl-page-word">Previous</span>
                    </button>
                    <span className="sl-page-status">Page {page} of {pages}</span>
                    <button
                      className="sl-page"
                      onClick={() => setPage(p => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                    >
                      <span className="sl-page-word">Next</span> ›
                    </button>
                  </nav>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* ── Read-only detail ─────────────────────── */}
      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title="SMS details"
        size="medium"
      >
        {detailLoading || !detail?.created_at ? (
          <p className="sl-detail-loading">Loading…</p>
        ) : (
          <div className="sl-detail">
            <dl className="sl-detail-grid">
              <div className="sl-detail-row">
                <dt>Status</dt>
                <dd>
                  <span className={`sl-badge ${detail.status === 'failed' ? 'sl-badge--failed' : 'sl-badge--sent'}`}>
                    {detail.status === 'failed' ? <FiXCircle size={12} /> : <FiCheckCircle size={12} />}
                    {detail.status === 'failed' ? 'Failed' : 'Sent'}
                  </span>
                </dd>
              </div>
              <div className="sl-detail-row">
                <dt>Date / Time</dt>
                <dd>{dayFmt.format(new Date(detail.created_at))} · {timeFmt.format(new Date(detail.created_at))}</dd>
              </div>
              <div className="sl-detail-row">
                <dt>Recipient</dt>
                <dd>{detail.recipient_name || '—'}</dd>
              </div>
              <div className="sl-detail-row">
                <dt>Phone</dt>
                <dd className="sl-mono">{detail.phone || '—'}</dd>
              </div>
              <div className="sl-detail-row">
                <dt>Event</dt>
                <dd>{detail.event_name || '—'}</dd>
              </div>
              <div className="sl-detail-row">
                <dt>Type</dt>
                <dd>{typeLabel(detail.type)}</dd>
              </div>
            </dl>

            <div className="sl-detail-block">
              <span className="sl-detail-label">Full message</span>
              <pre className="sl-detail-message">{detail.message || '—'}</pre>
            </div>

            {detail.status === 'failed' && (
              <div className="sl-detail-block">
                <span className="sl-detail-label">Provider error</span>
                <pre className="sl-detail-error">
                  {detail.error_text || 'No provider error was recorded for this attempt.'}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
