import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { FiDollarSign } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import EmptyState from './EmptyState';
import './PieChartCard.css';

const SLICES = [
  { key: 'paid',    label: 'Total Paid',        color: '#00B894' },
  { key: 'pending', label: 'Partially Pending', color: '#FFA500' },
  { key: 'unpaid',  label: 'Unpaid Balance',    color: '#FF4C4C' },
];

// ── Skeleton ────────────────────────────────────────────────
export function PieChartSkeleton() {
  return (
    <div className="section-card pie-chart-skeleton">
      <div className="skeleton pie-sk-title" />
      <div className="pie-sk-donut-wrap">
        <div className="pie-sk-donut skeleton" />
      </div>
      <div className="pie-sk-legend">
        {[1, 2, 3].map(i => (
          <div key={i} className="pie-sk-legend-item">
            <div className="skeleton pie-sk-dot" />
            <div className="pie-sk-legend-text">
              <div className="skeleton pie-sk-lbl" />
              <div className="skeleton pie-sk-val" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom tooltip ───────────────────────────────────────────
function CustomTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const d   = payload[0].payload;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
  return (
    <div className="pie-tooltip">
      <span className="pie-tooltip-dot" style={{ background: d.color }} />
      <div className="pie-tooltip-body">
        <span className="pie-tooltip-label">{d.label}</span>
        <span className="pie-tooltip-value" style={{ color: d.color }}>
          {formatCurrency(d.value)}
        </span>
        <span className="pie-tooltip-pct">{pct}% of total</span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function PieChartCard({ chartData, loading }) {
  if (loading) return <PieChartSkeleton />;

  const raw = SLICES.map(s => ({
    key:   s.key,
    label: s.label,
    color: s.color,
    value: parseFloat(chartData?.[s.key] ?? 0),
  }));

  const total = raw.reduce((sum, d) => sum + d.value, 0);
  const data  = raw.filter(d => d.value > 0);

  return (
    <div className="section-card pie-chart-card">
      <h2 className="section-title">Contribution Overview</h2>

      {total === 0 ? (
        <EmptyState
          IconComponent={FiDollarSign}
          title="No contribution data"
          description="Contribution breakdown will appear here once data is added."
        />
      ) : (
        <>
          {/* ── Donut chart — height controlled by CSS ── */}
          <div className="pie-donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="76%"
                  paddingAngle={data.length > 1 ? 3 : 0}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={900}
                  animationEasing="ease-out"
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip total={total} />}
                  cursor={false}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered total label — absolute overlay */}
            <div className="pie-center">
              <span className="pie-center-value">{formatCurrency(total)}</span>
              <span className="pie-center-sub">Total Pledged</span>
            </div>
          </div>

          {/* ── Legend rows ─────────────────────────── */}
          <div className="pie-legend">
            {raw.map(d => {
              const pct    = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
              const active = d.value > 0;
              return (
                <div
                  key={d.key}
                  className={`pie-legend-item${active ? '' : ' pie-legend-item--zero'}`}
                >
                  <span
                    className="pie-legend-dot"
                    style={{ background: active ? d.color : 'var(--text-muted)' }}
                  />
                  <div className="pie-legend-text">
                    <span className="pie-legend-label">{d.label}</span>
                    <span
                      className="pie-legend-amount"
                      style={{ color: active ? d.color : 'var(--text-muted)' }}
                    >
                      {formatCurrency(d.value)}
                    </span>
                  </div>
                  <span className="pie-legend-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
