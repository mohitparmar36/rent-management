import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Receipt, UserMinus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import { DetailList, Section } from '../../components/common/Section';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/common/States';
import { EndRentalModal } from '../../components/rentals/RentalModals';
import MarkPaidModal from '../../components/rent/MarkPaidModal';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getRental } from '../../services/api.service';
import { formatDate, formatMoney, formatMonth } from '../../utils/format';

export default function RentalDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = user.role !== 'Tenant';
  const { data: r, loading, error, reload } = useAsync(() => getRental(id), [id]);
  const [modal, setModal] = useState(null);
  const [paying, setPaying] = useState(null);

  if (loading && !r) return <PageSkeleton cards={3} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const isActive = r.status === 'Active';
  const title = canManage ? `${r.tenantName} · ${r.propertyName}` : r.propertyName;

  return (
    <div className="fade-in-up">
      <PageHeader
        title={title}
        breadcrumbs={[{ label: canManage ? 'Rentals' : 'My home', to: '/rentals' }]}
        actions={canManage && isActive && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModal('end')}><UserMinus size={16} /> End rental</button>
            <Link to={`/rent/new?rental=${r.tenantPropertyId}`} className="btn btn-primary"><Receipt size={16} /> Add rent</Link>
          </>
        )}
      />

      <div className="card hero">
        <span className="hero-icon" aria-hidden="true"><ClipboardList size={26} /></span>
        <div className="hero-main">
          <div className="hero-title">
            <Link to={`/properties/${r.propertyId}`} className="cell-link">{r.propertyName}</Link>
            <StatusBadge status={r.status} label={isActive ? 'Active rental' : 'Ended'} />
          </div>
          <p className="hero-sub">{r.propertyAddress}</p>
          <p className="hero-sub">{formatDate(r.startDate)} – {r.endDate ? formatDate(r.endDate) : 'present'}</p>
        </div>
        <div className="hero-figures">
          <div className="hero-figure"><span>Monthly rent</span><strong>{formatMoney(r.monthlyRent)}</strong></div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Paid" value={formatMoney(r.rentSummary.totalCollected)} tone="success" icon={CheckCircle2} hint={`${r.rentSummary.paidCount} months`} />
        <StatCard label="Pending" value={formatMoney(r.rentSummary.pendingAmount)} tone="warning" hint={`${r.rentSummary.pendingCount} months`} />
        <StatCard label="Overdue" value={formatMoney(r.rentSummary.overdueAmount)} tone="danger" hint={`${r.rentSummary.overdueCount} months`} />
      </div>

      <div className="grid-main-side">
        <Section title="Rent records" flush>
          <DataTable
            columns={[
              { key: 'month', header: 'Month', render: (p) => <Link to={`/rent/${p.paymentId}`} className="cell-link">{formatMonth(p.billingMonth, 'long')}</Link> },
              { key: 'due', header: 'Due', render: (p) => formatDate(p.dueDate) },
              { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="cell-money">{formatMoney(p.amount)}</span> },
              { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
              { key: 'paid', header: 'Paid on', render: (p) => (p.paymentDate ? `${formatDate(p.paymentDate)} · ${p.paymentMethod}` : <span className="cell-muted">—</span>) },
              ...(canManage ? [{
                key: 'actions', header: '', align: 'right',
                render: (p) => p.status !== 'Paid' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPaying(p)}>Record payment</button>
                ),
              }] : []),
            ]}
            rows={r.rentRecords}
            rowKey={(p) => p.paymentId}
            rowLink={(p) => `/rent/${p.paymentId}`}
            empty={<EmptyState icon={Receipt} title="No rent records yet" compact
              description={canManage && isActive ? 'Use “Add rent” to bill the first month.' : undefined} />}
          />
        </Section>

        <Section title={canManage ? 'Tenant' : 'Landlord'}>
          <DetailList
            columns={1}
            items={canManage ? [
              { label: 'Name', value: <Link to={`/tenants/${r.tenantId}`} className="cell-link">{r.tenantName}</Link> },
              { label: 'Email', value: r.tenantEmail },
              { label: 'Phone', value: r.tenantPhone },
              { label: 'Landlord', value: r.landlordName },
            ] : [
              { label: 'Name', value: r.landlordName },
              { label: 'Email', value: <a href={`mailto:${r.landlordEmail}`} className="cell-link">{r.landlordEmail}</a> },
              { label: 'Phone', value: r.landlordPhone },
            ]}
          />
        </Section>
      </div>

      <EndRentalModal isOpen={modal === 'end'} onClose={() => setModal(null)} onEnded={reload} rental={r} />
      <MarkPaidModal isOpen={Boolean(paying)} onClose={() => setPaying(null)} onPaid={reload}
        payment={paying && { ...paying, tenantName: r.tenantName, propertyName: r.propertyName }} />
    </div>
  );
}
