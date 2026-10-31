import { Link } from 'react-router-dom';
import { Bell, CalendarClock, DollarSign, Home, Mail, Phone, Receipt, Wrench } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import ItemList from '../../components/common/ItemList';
import { DetailList, Section } from '../../components/common/Section';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/common/States';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getTenantDashboard } from '../../services/api.service';
import { formatDate, formatMoney, formatMonth, formatRelative } from '../../utils/format';

export default function TenantDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(getTenantDashboard, []);

  if (loading && !data) return <PageSkeleton cards={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const lease = data.currentLease;
  const outstanding = data.rent.pendingAmount + data.rent.overdueAmount;

  return (
    <div className="fade-in-up">
      <PageHeader
        eyebrow="Tenant"
        title={`Welcome back, ${user.firstName}`}
        subtitle={lease ? 'Your home, rent and requests in one place.' : undefined}
        actions={lease && <Link to="/complaints/new" className="btn btn-primary btn-sm"><Wrench size={15} /> Report an issue</Link>}
      />

      {lease ? (
        <>
          <div className="card hero">
            <span className="hero-icon" aria-hidden="true"><Home size={26} /></span>
            <div className="hero-main">
              <div className="hero-title">
                <Link to={`/properties/${lease.propertyId}`} className="cell-link">{lease.propertyName}</Link>
                <StatusBadge status="Active" />
              </div>
              <p className="hero-sub">{lease.propertyAddress}</p>
              <p className="hero-sub">Renting since {formatDate(lease.startDate)}{lease.endDate ? ` · until ${formatDate(lease.endDate)}` : ''}</p>
            </div>
            <div className="hero-figures">
              <div className="hero-figure"><span>Monthly rent</span><strong>{formatMoney(lease.monthlyRent)}</strong></div>
            </div>
          </div>

          <div className="stat-grid">
            <StatCard
              label="Next rent due"
              icon={CalendarClock}
              tone={data.nextDue?.status === 'Overdue' ? 'danger' : 'primary'}
              value={data.nextDue ? formatMoney(data.nextDue.amount) : 'All paid'}
              hint={data.nextDue ? `${data.nextDue.status === 'Overdue' ? 'Overdue since' : 'Due'} ${formatDate(data.nextDue.dueDate)}` : 'Nothing outstanding'}
              to={data.nextDue ? `/rent/${data.nextDue.paymentId}` : '/rent'}
            />
            <StatCard label="Outstanding balance" value={formatMoney(outstanding)} icon={DollarSign}
              tone={data.rent.overdueAmount > 0 ? 'danger' : 'success'} to="/rent"
              hint={data.rent.overdueCount ? `${data.rent.overdueCount} overdue` : 'No overdue rent'} />
            <StatCard
              label="Latest rent"
              icon={Receipt}
              tone="info"
              value={data.latestRent ? <StatusBadge status={data.latestRent.status} /> : '—'}
              hint={data.latestRent ? `${formatMonth(data.latestRent.billingMonth, 'long')} · ${formatMoney(data.latestRent.amount)}` : 'No rent records yet'}
              to="/rent"
            />
            <StatCard label="Open complaints" value={data.openComplaints} icon={Wrench} tone="warning" to="/complaints" />
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={Home}
            title="You're not linked to a property yet"
            description="When your landlord assigns you to a property, your rent, due dates and maintenance requests will appear here."
          />
        </div>
      )}

      <div className="grid-2 mt-20">
        <Section title="Recent notifications" flush actions={<Link to="/notifications" className="btn btn-link btn-sm">View all</Link>}>
          <ItemList
            empty={<EmptyState icon={Bell} title="No notifications yet" compact />}
            items={data.recentNotifications.map((n) => ({
              key: n.notificationId,
              title: n.title,
              subtitle: n.message,
              end: <span className="cell-muted">{formatRelative(n.createdAt)}</span>,
            }))}
          />
        </Section>

        {lease ? (
          <Section title="Your landlord">
            <DetailList
              columns={1}
              items={[
                { label: 'Name', value: lease.landlordName },
                { label: 'Email', value: <a href={`mailto:${lease.landlordEmail}`} className="cell-link"><Mail size={13} /> {lease.landlordEmail}</a> },
                { label: 'Phone', value: lease.landlordPhone && <a href={`tel:${lease.landlordPhone}`} className="cell-link"><Phone size={13} /> {lease.landlordPhone}</a> },
              ]}
            />
          </Section>
        ) : (
          <div />
        )}
      </div>

      {data.rentalHistory.length > 0 && (
        <Section title="Rental history" description="Places you have rented through RentEase." flush className="mt-20">
          <ItemList
            items={data.rentalHistory.map((h) => ({
              key: h.tenantPropertyId,
              to: `/rentals/${h.tenantPropertyId}`,
              title: h.propertyName,
              subtitle: `${formatDate(h.startDate)} – ${formatDate(h.endDate)} · ${h.propertyAddress}`,
              end: <StatusBadge status={h.status} />,
            }))}
          />
        </Section>
      )}
    </div>
  );
}
