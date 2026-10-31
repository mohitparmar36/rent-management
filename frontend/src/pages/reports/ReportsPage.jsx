import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { Tabs } from '../../components/common/Filters';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/common/States';
import { CHART_COLORS, DonutChart, RentByMonthChart } from '../../components/charts/Charts';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getComplaintReport, getOccupancyReport, getRentCollectionReport } from '../../services/api.service';
import { formatDate, formatMoney, formatMonth } from '../../utils/format';

const PERIODS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '24', label: '24 months' },
];

const STATUS_COLORS = { Open: CHART_COLORS.danger, 'In Progress': CHART_COLORS.accent, Resolved: CHART_COLORS.primary };
const PRIORITY_COLORS = { High: CHART_COLORS.danger, Medium: CHART_COLORS.accent, Low: CHART_COLORS.neutral };

/** Downloads rows as a CSV file (opens in Excel). */
function downloadCsv(filename, header, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [months, setMonths] = useState('12');

  const rent = useAsync(() => getRentCollectionReport(Number(months)), [months]);
  const occupancy = useAsync(getOccupancyReport, []);
  const complaints = useAsync(getComplaintReport, []);

  if (!rent.data && !occupancy.data && !complaints.data && (rent.loading || occupancy.loading || complaints.loading)) {
    return <PageSkeleton cards={4} />;
  }

  const totals = rent.data?.totals;
  const billed = rent.data?.months.reduce((s, m) => s + m.billed, 0) ?? 0;
  const collected = rent.data?.months.reduce((s, m) => s + m.collected, 0) ?? 0;
  const collectionRate = billed ? Math.round((collected / billed) * 100) : null;

  function exportRent() {
    downloadCsv(`rent-collection-${months}m.csv`, ['Month', 'Billed', 'Collected', 'Outstanding'],
      rent.data.months.map((m) => [formatMonth(m.month, 'long'), m.billed, m.collected, m.outstanding]));
  }

  function exportOutstanding() {
    downloadCsv('outstanding-rent.csv', ['Month', 'Tenant', 'Property', 'Due date', 'Amount', 'Status'],
      rent.data.outstanding.map((r) => [formatMonth(r.billingMonth, 'long'), r.tenantName, r.propertyName, r.dueDate, r.amount, r.status]));
  }

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Reports"
        subtitle={user.role === 'Admin' ? 'System-wide rent, occupancy and maintenance figures.' : 'Rent, occupancy and maintenance figures for your properties.'}
      />

      {/* ── Rent collection ─────────────────────────────────────────────── */}
      {rent.error ? <ErrorState message={rent.error} onRetry={rent.reload} /> : rent.data && (
        <>
          <div className="stat-grid">
            <StatCard label="Collected (all time)" value={formatMoney(totals.totalCollected)} tone="success" hint={`${totals.paidCount} payments`} />
            <StatCard label="Pending" value={formatMoney(totals.pendingAmount)} tone="warning" hint={`${totals.pendingCount} records`} />
            <StatCard label="Overdue" value={formatMoney(totals.overdueAmount)} tone="danger" hint={`${totals.overdueCount} records`} />
            <StatCard label={`Collection rate (${months} mo)`} value={collectionRate === null ? '—' : `${collectionRate}%`} tone="primary"
              hint={billed ? `${formatMoney(collected)} of ${formatMoney(billed)} billed` : 'Nothing billed in this period'} />
          </div>

          <Section
            title="Rent collection by month"
            description="Rent billed per month, split into what has been collected and what is still outstanding."
            actions={
              <>
                <Tabs label="Period" tabs={PERIODS} value={months} onChange={setMonths} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={exportRent}><Download size={15} /> CSV</button>
              </>
            }
          >
            <RentByMonthChart data={rent.data.months} height={300} />
          </Section>

          <Section
            title="Outstanding rent"
            description="Pending and overdue records, oldest first."
            flush
            className="mt-20"
            actions={rent.data.outstanding.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={exportOutstanding}><Download size={15} /> CSV</button>
            )}
          >
            <DataTable
              columns={[
                { key: 'month', header: 'Month', render: (r) => <Link to={`/rent/${r.paymentId}`} className="cell-link">{formatMonth(r.billingMonth)}</Link> },
                { key: 'tenant', header: 'Tenant', render: (r) => <><span className="cell-primary">{r.tenantName}</span><span className="cell-sub">{r.propertyName}</span></> },
                { key: 'due', header: 'Due', render: (r) => formatDate(r.dueDate) },
                { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="cell-money">{formatMoney(r.amount)}</span> },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={rent.data.outstanding}
              rowKey={(r) => r.paymentId}
              rowLink={(r) => `/rent/${r.paymentId}`}
              empty={<EmptyState title="Nothing outstanding" description="Every rent record has been paid." compact />}
            />
          </Section>
        </>
      )}

      <div className="grid-2 mt-20">
        {/* ── Occupancy ─────────────────────────────────────────────────── */}
        <Section title="Property occupancy" description={occupancy.data ? `${occupancy.data.occupancyRate}% of properties are occupied.` : undefined}>
          {occupancy.error ? <ErrorState message={occupancy.error} onRetry={occupancy.reload} compact /> : occupancy.data && (
            <DonutChart
              centerLabel="properties"
              emptyText="No properties yet"
              segments={[
                { label: 'Occupied', value: occupancy.data.occupied, color: CHART_COLORS.primary },
                { label: 'Available', value: occupancy.data.available, color: CHART_COLORS.accent },
                { label: 'Maintenance', value: occupancy.data.maintenance, color: CHART_COLORS.neutral },
              ]}
            />
          )}
        </Section>

        {/* ── Complaints ────────────────────────────────────────────────── */}
        <Section
          title="Complaint status"
          description={complaints.data?.averageResolutionDays != null
            ? `Resolved complaints took ${complaints.data.averageResolutionDays} days on average.`
            : undefined}
        >
          {complaints.error ? <ErrorState message={complaints.error} onRetry={complaints.reload} compact /> : complaints.data && (
            <DonutChart
              centerLabel="complaints"
              emptyText="No complaints yet"
              segments={complaints.data.byStatus.map((s) => ({ label: s.label, value: s.count, color: STATUS_COLORS[s.label] }))}
            />
          )}
        </Section>
      </div>

      {complaints.data && complaints.data.total > 0 && (
        <div className="grid-2 mt-20">
          <Section title="Complaints by priority">
            <DonutChart centerLabel="complaints"
              segments={complaints.data.byPriority.map((s) => ({ label: s.label, value: s.count, color: PRIORITY_COLORS[s.label] }))} />
          </Section>
          <Section title="Complaints by category">
            <ul className="donut-legend">
              {complaints.data.byCategory.map((c) => (
                <li key={c.label}>
                  <span className="donut-legend-label">{c.label}</span>
                  <span className="progress" style={{ flex: 2 }}>
                    <span style={{ width: `${(c.count / complaints.data.total) * 100}%` }} />
                  </span>
                  <strong>{c.count}</strong>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {occupancy.data && occupancy.data.properties.length > 0 && (
        <Section title="Properties by status" flush className="mt-20">
          <DataTable
            columns={[
              { key: 'name', header: 'Property', render: (p) => <Link to={`/properties/${p.propertyId}`} className="cell-link">{p.propertyName}</Link> },
              { key: 'city', header: 'City', render: (p) => p.city },
              { key: 'rent', header: 'Rent', align: 'right', render: (p) => <span className="cell-money">{formatMoney(p.monthlyRent)}</span> },
              { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
              { key: 'tenant', header: 'Tenant', render: (p) => p.currentTenantName ?? <span className="cell-muted">Vacant</span> },
            ]}
            rows={occupancy.data.properties}
            rowKey={(p) => p.propertyId}
            rowLink={(p) => `/properties/${p.propertyId}`}
          />
        </Section>
      )}
    </div>
  );
}
