import { Link } from 'react-router-dom';
import { AlertCircle, Building2, DollarSign, Receipt, UserPlus, Users, Wrench } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import ItemList from '../../components/common/ItemList';
import { Section } from '../../components/common/Section';
import { ErrorState, PageSkeleton } from '../../components/common/States';
import { CHART_COLORS, DonutChart, RentByMonthChart } from '../../components/charts/Charts';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getAdminDashboard } from '../../services/api.service';
import { formatMoney, formatRelative } from '../../utils/format';

const ACTIVITY_ICONS = {
  payment: { icon: Receipt, tone: 'success' },
  complaint: { icon: Wrench, tone: 'warning' },
  user: { icon: UserPlus, tone: 'info' },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(getAdminDashboard, []);

  if (loading && !data) return <PageSkeleton cards={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { rent } = data;

  return (
    <div className="fade-in-up">
      <PageHeader
        eyebrow="Admin overview"
        title={`Welcome back, ${user.firstName}`}
        subtitle="Everything happening across RentEase — users, properties, rent and maintenance."
        actions={<Link to="/reports" className="btn btn-ghost btn-sm">View reports</Link>}
      />

      <div className="stat-grid">
        <StatCard label="Users" value={data.totalUsers} icon={Users} tone="info" to="/users"
          hint={`${data.totalLandlords} landlords · ${data.totalTenants} tenants`} />
        <StatCard label="Properties" value={data.totalProperties} icon={Building2} tone="primary" to="/properties"
          hint={`${data.occupiedProperties} occupied · ${data.availableProperties} available`} />
        <StatCard label="Rent collected" value={formatMoney(rent.totalCollected)} icon={DollarSign} tone="success"
          to="/rent?status=Paid" hint={`${rent.paidCount} payments recorded`} />
        <StatCard label="Pending rent" value={formatMoney(rent.pendingAmount + rent.overdueAmount)} icon={AlertCircle}
          tone="danger" to="/rent?status=Overdue" hint={`${formatMoney(rent.overdueAmount)} overdue`} />
        <StatCard label="Open complaints" value={data.openComplaints} icon={Wrench} tone="warning" to="/complaints?status=Open"
          hint="Open or in progress" />
      </div>

      <div className="grid-main-side">
        <Section title="Rent by month" description="Collected and outstanding rent for the last six billing months.">
          <RentByMonthChart data={data.monthlyCollection} />
        </Section>
        <Section title="Occupancy" description="Current status of every property.">
          <DonutChart
            centerLabel="properties"
            emptyText="No properties yet"
            segments={[
              { label: 'Occupied', value: data.occupiedProperties, color: CHART_COLORS.primary },
              { label: 'Available', value: data.availableProperties, color: CHART_COLORS.accent },
              { label: 'Maintenance', value: data.maintenanceProperties, color: CHART_COLORS.neutral },
            ]}
          />
        </Section>
      </div>

      <Section title="Recent activity" description="The latest rent records, complaints and new accounts." flush className="mt-20">
        <ItemList
          items={data.recentActivity.map((a, i) => {
            const { icon: Icon, tone } = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.user;
            return {
              key: `${a.type}-${i}`,
              to: a.link,
              icon: (
                <span className={`activity-icon tone-${tone}`} aria-hidden="true">
                  <Icon size={16} />
                </span>
              ),
              title: a.title,
              subtitle: a.description,
              end: <span className="cell-muted">{formatRelative(a.occurredAt)}</span>,
            };
          })}
        />
      </Section>
    </div>
  );
}
