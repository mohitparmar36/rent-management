import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Home, Receipt, UserMinus, UserPlus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import { DetailList, Section } from '../../components/common/Section';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/common/States';
import { AssignRentalModal, EndRentalModal } from '../../components/rentals/RentalModals';
import useAsync from '../../hooks/useAsync';
import { getTenant } from '../../services/api.service';
import { formatDate, formatMoney, initials } from '../../utils/format';

export default function TenantDetailsPage() {
  const { id } = useParams();
  const { data: t, loading, error, reload } = useAsync(() => getTenant(id), [id]);
  const [modal, setModal] = useState(null);

  if (loading && !t) return <PageSkeleton cards={3} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const active = t.assignments.find((a) => a.status === 'Active');
  const fullName = `${t.firstName} ${t.lastName}`;
  const { rentSummary: rent } = t;

  return (
    <div className="fade-in-up">
      <PageHeader
        title={fullName}
        breadcrumbs={[{ label: 'Tenants', to: '/tenants' }]}
        actions={
          active ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModal('end')}><UserMinus size={16} /> End rental</button>
              <Link to={`/rent/new?rental=${active.tenantPropertyId}`} className="btn btn-primary"><Receipt size={16} /> Add rent</Link>
            </>
          ) : (
            t.isActive && (
              <button type="button" className="btn btn-primary" onClick={() => setModal('assign')}>
                <UserPlus size={16} /> Assign to property
              </button>
            )
          )
        }
      />

      <div className="card hero">
        <span className="avatar avatar-lg" aria-hidden="true">{initials(t)}</span>
        <div className="hero-main">
          <div className="hero-title">{fullName} <StatusBadge status={t.isActive ? 'Active' : 'Inactive'} label={t.isActive ? 'Active account' : 'Deactivated'} /></div>
          <p className="hero-sub">{active ? <>Renting <Link to={`/properties/${active.propertyId}`} className="cell-link">{active.propertyName}</Link> since {formatDate(active.startDate)}</> : 'Not currently renting'}</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Rent paid" value={formatMoney(rent.totalCollected)} tone="success" hint={`${rent.paidCount} payments`} />
        <StatCard label="Pending" value={formatMoney(rent.pendingAmount)} tone="warning" hint={`${rent.pendingCount} records`} />
        <StatCard label="Overdue" value={formatMoney(rent.overdueAmount)} tone="danger" hint={`${rent.overdueCount} records`}
          to={`/rent?tenantId=${t.userId}&status=Overdue`} />
      </div>

      <div className="grid-main-side">
        <Section title="Rentals" description="Current and past rentals." flush>
          <DataTable
            columns={[
              { key: 'property', header: 'Property', render: (a) => <Link to={`/rentals/${a.tenantPropertyId}`} className="cell-link">{a.propertyName}</Link> },
              { key: 'rent', header: 'Rent', align: 'right', render: (a) => <span className="cell-money">{formatMoney(a.monthlyRent)}</span> },
              { key: 'from', header: 'From', render: (a) => formatDate(a.startDate) },
              { key: 'to', header: 'To', render: (a) => (a.endDate ? formatDate(a.endDate) : 'Present') },
              { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
            ]}
            rows={t.assignments}
            rowKey={(a) => a.tenantPropertyId}
            rowLink={(a) => `/rentals/${a.tenantPropertyId}`}
            empty={<EmptyState icon={Home} title="No rentals yet" compact />}
          />
        </Section>

        <Section title="Contact">
          <DetailList
            columns={1}
            items={[
              { label: 'Email', value: <a href={`mailto:${t.email}`} className="cell-link">{t.email}</a> },
              { label: 'Phone', value: t.phoneNumber && <a href={`tel:${t.phoneNumber}`} className="cell-link">{t.phoneNumber}</a> },
              { label: 'Account created', value: formatDate(t.createdAt) },
            ]}
          />
          <div className="mt-20">
            <Link to={`/rent?tenantId=${t.userId}`} className="btn btn-ghost btn-sm"><Receipt size={15} /> View rent history</Link>
          </div>
        </Section>
      </div>

      <AssignRentalModal isOpen={modal === 'assign'} onClose={() => setModal(null)} onAssigned={reload} tenant={t} />
      <EndRentalModal isOpen={modal === 'end'} onClose={() => setModal(null)} onEnded={reload} rental={active} />
    </div>
  );
}
