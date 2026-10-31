import { Link } from 'react-router-dom';
import { AlertCircle, Building2, DollarSign, Plus, Receipt, Users, Wrench } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import ItemList from '../../components/common/ItemList';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/common/States';
import { CHART_COLORS, DonutChart, RentByMonthChart } from '../../components/charts/Charts';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getLandlordDashboard } from '../../services/api.service';
import { formatDate, formatMoney, formatMonth, formatRelative } from '../../utils/format';

export default function LandlordDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(getLandlordDashboard, []);

  if (loading && !data) return <PageSkeleton cards={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { rent } = data;

  if (data.totalProperties === 0) {
    return (
      <div className="fade-in-up">
        <PageHeader eyebrow="Landlord" title={`Welcome, ${user.firstName}`} />
        <div className="card">
          <EmptyState
            icon={Building2}
            title="Add your first property"
            description="Once you add a property and assign a tenant, rent, complaints and occupancy figures will appear here."
            action={<Link to="/properties/new" className="btn btn-primary"><Plus size={16} /> Add property</Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      <PageHeader
        eyebrow="Landlord overview"
        title={`Welcome back, ${user.firstName}`}
        subtitle="Your portfolio at a glance."
        actions={
          <>
            <Link to="/rent/new" className="btn btn-ghost btn-sm"><Receipt size={15} /> Add rent record</Link>
            <Link to="/properties/new" className="btn btn-primary btn-sm"><Plus size={15} /> Add property</Link>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard label="Properties" value={data.totalProperties} icon={Building2} tone="primary" to="/properties"
          hint={`${data.occupiedProperties} occupied · ${data.availableProperties} available`} />
        <StatCard label="Active tenants" value={data.totalTenants} icon={Users} tone="info" to="/tenants?status=Housed" />
        <StatCard label="Rent collected" value={formatMoney(rent.totalCollected)} icon={DollarSign} tone="success"
          to="/rent?status=Paid" hint={`${rent.paidCount} payments`} />
        <StatCard label="Pending rent" value={formatMoney(rent.pendingAmount)} icon={Receipt} tone="warning"
          to="/rent?status=Pending" hint={`${rent.pendingCount} not yet due`} />
        <StatCard label="Overdue rent" value={formatMoney(rent.overdueAmount)} icon={AlertCircle} tone="danger"
          to="/rent?status=Overdue" hint={`${rent.overdueCount} past due date`} />
      </div>

      <div className="grid-main-side">
        <Section title="Rent by month" description="Collected and outstanding rent for the last six billing months.">
          <RentByMonthChart data={data.monthlyCollection} />
        </Section>
        <Section title="Occupancy">
          <DonutChart
            centerLabel="properties"
            segments={[
              { label: 'Occupied', value: data.occupiedProperties, color: CHART_COLORS.primary },
              { label: 'Available', value: data.availableProperties, color: CHART_COLORS.accent },
              { label: 'Maintenance', value: data.maintenanceProperties, color: CHART_COLORS.neutral },
            ]}
          />
        </Section>
      </div>

      <div className="grid-2 mt-20">
        <Section title="Recent rent" flush actions={<Link to="/rent" className="btn btn-link btn-sm">View all</Link>}>
          <ItemList
            empty={<EmptyState icon={Receipt} title="No rent records yet" compact />}
            items={data.recentRent.map((r) => ({
              key: r.paymentId,
              to: `/rent/${r.paymentId}`,
              title: `${r.propertyName} · ${r.tenantName}`,
              subtitle: `${formatMonth(r.billingMonth)} · due ${formatDate(r.dueDate)}`,
              end: (
                <>
                  <span className="cell-money">{formatMoney(r.amount)}</span>
                  <StatusBadge status={r.status} />
                </>
              ),
            }))}
          />
        </Section>

        <Section
          title={`Complaints${data.openComplaints ? ` · ${data.openComplaints} open` : ''}`}
          flush
          actions={<Link to="/complaints" className="btn btn-link btn-sm">View all</Link>}
        >
          <ItemList
            empty={<EmptyState icon={Wrench} title="No complaints" description="Your tenants haven't reported any issues." compact />}
            items={data.recentComplaints.map((c) => ({
              key: c.complaintId,
              to: `/complaints/${c.complaintId}`,
              title: c.title,
              subtitle: `${c.propertyName} · ${c.tenantName} · ${formatRelative(c.createdAt)}`,
              end: (
                <>
                  <StatusBadge status={c.status} />
                  <StatusBadge status={c.priority} />
                </>
              ),
            }))}
          />
        </Section>
      </div>
    </div>
  );
}
