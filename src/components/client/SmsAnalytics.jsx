import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { FiBarChart2, FiAlertTriangle } from 'react-icons/fi';
import { smsHistoryService } from '../../services/smsHistoryService';
import { getErrorMessage } from '../../utils/helpers';
import './SmsAnalytics.css';

/*  Dashboard analytics over sms_history.

    Every number is aggregated server-side and scoped to what the caller is
    allowed to see — the full log table is never loaded into the browser and
    nothing here is dummy data. Charts reuse recharts, already a dependency.  */

const PERIODS = [
  { value: 7,  label: '7 days'  },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const TYPE_LABELS = {
  custom_member:          'Custom — one member',
  custom_campaign_member: 'Custom — Send to All',
  custom:                 'Dispatch — custom',
  bulk:                   'Dispatch — reminder',
  reminder:               'Payment reminder',
};

const dayTick = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/* Shared tooltip so all three charts read identically. */
function ChartTip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="sa-tip">
      {label !== undefined && <p className="sa-tip-label">{label}</p>}
      {payload.map(p => (
        <p className="sa-tip-row" key={p.dataKey ?? p.name}>
          <span className="sa-tip-dot" style={{ background: p.color || p.payload?.fill }} />
          <span className="sa-tip-name">{p.name}</span>
          <span className="sa-tip-value">{p.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
}

export default function SmsAnalytics() {
  const [days,    setDays]    = useState(30);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await smsHistoryService.analytics(days);
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const trend = useMemo(
    () => (data?.trend || []).map(d => ({ ...d, tick: dayTick(d.date) })),
    [data],
  );

  const byType = useMemo(
    () => (data?.byType || []).map(t => ({ ...t, label: TYPE_LABELS[t.type] || t.type })),
    [data],
  );

  const statusData = useMemo(() => {
    if (!data?.status) return [];
    return [
      { name: 'Sent',   value: data.status.sent,   key: 'sent' },
      { name: 'Failed', value: data.status.failed, key: 'failed' },
    ].filter(s => s.value > 0);
  }, [data]);

  const hasAny = (data?.status?.total || 0) > 0;
  const successRate = data?.status?.total
    ? Math.round((data.status.sent / data.status.total) * 100)
    : 0;

  /* ── Shell ────────────────────────────────────────────── */
  return (
    <section className="sa" aria-label="SMS analytics">
      <header className="sa-head">
        <div className="sa-head-copy">
          <p className="sa-eyebrow">Analytics</p>
          <h3 className="sa-title">SMS activity</h3>
        </div>
        <div className="sa-periods" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              className={`sa-period ${days === p.value ? 'is-active' : ''}`}
              onClick={() => setDays(p.value)}
              aria-pressed={days === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="sa-grid">
          <div className="sa-card sa-card--wide"><div className="sa-skeleton" /></div>
          <div className="sa-card"><div className="sa-skeleton" /></div>
          <div className="sa-card"><div className="sa-skeleton" /></div>
        </div>
      ) : error ? (
        <div className="sa-state">
          <span className="sa-state-icon sa-state-icon--error"><FiAlertTriangle size={18} /></span>
          <span className="sa-state-title">Could not load analytics</span>
          <span className="sa-state-text">{error}</span>
          <button className="sa-retry" onClick={load}>Try again</button>
        </div>
      ) : !hasAny ? (
        <div className="sa-state">
          <span className="sa-state-icon"><FiBarChart2 size={18} /></span>
          <span className="sa-state-title">No SMS activity in this period</span>
          <span className="sa-state-text">
            Charts appear once messages have been sent. Try a longer period.
          </span>
        </div>
      ) : (
        <div className="sa-grid">

          {/* ── A. Daily trend — dots + lines ───────────── */}
          <article className="sa-card sa-card--wide">
            <header className="sa-card-head">
              <h4 className="sa-card-title">Daily volume</h4>
              <span className="sa-card-note">Sent vs failed, last {days} days</span>
            </header>
            <div className="sa-chart sa-chart--tall">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="tick" tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                    interval="preserveStartEnd" minTickGap={18}
                  />
                  <YAxis
                    tickLine={false} axisLine={false} allowDecimals={false} width={38}
                    tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
                  <Legend verticalAlign="top" height={26} iconType="plainline"
                    wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  {/* Distinct marker shapes carry identity alongside hue —
                      the status pair sits in the 6-8 CVD band. */}
                  <Line
                    type="monotone" dataKey="sent" name="Sent"
                    stroke="var(--chart-sent)" strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--chart-sent)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone" dataKey="failed" name="Failed"
                    stroke="var(--chart-failed)" strokeWidth={2} strokeDasharray="5 3"
                    dot={{ r: 3.5, fill: 'var(--chart-failed)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          {/* ── B. Volume by SMS type — bars ────────────── */}
          <article className="sa-card">
            <header className="sa-card-head">
              <h4 className="sa-card-title">By SMS type</h4>
              <span className="sa-card-note">Messages per mode</span>
            </header>
            <div className="sa-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byType} layout="vertical"
                  margin={{ top: 2, right: 14, bottom: 2, left: 2 }}
                  barCategoryGap={6}
                >
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" horizontal={false} />
                  <XAxis
                    type="number" tickLine={false} axisLine={false} allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                  />
                  <YAxis
                    type="category" dataKey="label" width={118}
                    tickLine={false} axisLine={false}
                    tick={{ fontSize: 10.5, fill: 'var(--chart-axis)' }}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--bg-subtle)' }} />
                  {/* One measure, one hue — never a rainbow per category */}
                  <Bar dataKey="total" name="Messages" fill="var(--chart-sent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          {/* ── C. Status split — donut ─────────────────── */}
          <article className="sa-card">
            <header className="sa-card-head">
              <h4 className="sa-card-title">Delivery status</h4>
              <span className="sa-card-note">Share of attempts</span>
            </header>
            <div className="sa-donut-wrap">
              <div className="sa-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData} dataKey="value" nameKey="name"
                      innerRadius="62%" outerRadius="88%"
                      paddingAngle={2} stroke="var(--bg-card)" strokeWidth={2}
                    >
                      {statusData.map(s => (
                        <Cell key={s.key} fill={`var(--chart-${s.key})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="sa-donut-center" aria-hidden="true">
                  <span className="sa-donut-value">{successRate}<i>%</i></span>
                  <span className="sa-donut-cap">delivered</span>
                </div>
              </div>

              {/* Direct labels — identity is never colour alone */}
              <dl className="sa-legend">
                <div className="sa-legend-row">
                  <dt><i className="sa-dot sa-dot--sent" />Sent</dt>
                  <dd>{data.status.sent}</dd>
                </div>
                <div className="sa-legend-row">
                  <dt><i className="sa-dot sa-dot--failed" />Failed</dt>
                  <dd>{data.status.failed}</dd>
                </div>
              </dl>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
