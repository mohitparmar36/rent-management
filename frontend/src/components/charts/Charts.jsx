import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatMoney, formatMoneyShort, formatMonth } from '../../utils/format';
import { EmptyState } from '../common/States';

// Chart colours — the same tokens as index.css, so charts match badges and buttons
export const CHART_COLORS = {
  primary: '#1b4b3a',
  accent: '#d9a24a',
  danger: '#c23b3b',
  warning: '#b8790a',
  info: '#2b5a8c',
  neutral: '#a8a49a',
  success: '#1b7a4d',
};

const axisStyle = { fontSize: 12, fill: '#6b6a66' };

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatMonth(label, 'long')}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <span className="chart-dot" style={{ background: p.color }} />
          {p.name}
          <strong>{formatMoney(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Collected vs outstanding rent per billing month (MonthlyRentPoint[] from the API). */
export function RentByMonthChart({ data, height = 260 }) {
  const hasData = data?.some((m) => m.billed > 0);
  if (!hasData) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No rent recorded in this period"
        description="Monthly totals appear here once rent records are created."
        compact
      />
    );
  }

  return (
    <div style={{ width: '100%', height }} role="img" aria-label="Bar chart of rent collected and outstanding by month">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ece7dd" />
          <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m)} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatMoneyShort} tick={axisStyle} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(27,75,58,0.05)' }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar animationDuration={500} dataKey="collected" name="Collected" stackId="rent" fill={CHART_COLORS.primary} radius={[0, 0, 0, 0]} maxBarSize={36} />
          <Bar animationDuration={500} dataKey="outstanding" name="Outstanding" stackId="rent" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut with a legend. segments: [{ label, value, color }]
 * The total is printed in the centre.
 */
export function DonutChart({ segments, centerLabel, height = 220, emptyText = 'No data yet' }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <EmptyState title={emptyText} compact />;

  return (
    <div className="donut">
      <div className="donut-chart" style={{ height }} role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={segments} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" animationDuration={500}
              paddingAngle={segments.filter((s) => s.value > 0).length > 1 ? 2 : 0} stroke="none">
              {segments.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="chart-dot" style={{ background: s.color }} />
            <span className="donut-legend-label">{s.label}</span>
            <strong>{s.value}</strong>
            <span className="donut-legend-pct">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
