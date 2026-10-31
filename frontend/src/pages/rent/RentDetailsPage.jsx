import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Info } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { DetailList, Section } from '../../components/common/Section';
import { ErrorState, PageSkeleton } from '../../components/common/States';
import MarkPaidModal from '../../components/rent/MarkPaidModal';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getRentPayment } from '../../services/api.service';
import { formatDate, formatDateTime, formatMoney, formatMonth } from '../../utils/format';

export default function RentDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = user.role !== 'Tenant';
  const { data: r, loading, error, reload } = useAsync(() => getRentPayment(id), [id]);
  const [paying, setPaying] = useState(false);

  if (loading && !r) return <PageSkeleton cards={0} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const isPaid = r.status === 'Paid';

  return (
    <div className="fade-in-up">
      <PageHeader
        title={`Rent for ${formatMonth(r.billingMonth, 'long')}`}
        breadcrumbs={[{ label: canManage ? 'Rent' : 'My rent', to: '/rent' }]}
        actions={canManage && !isPaid && (
          <button type="button" className="btn btn-primary" onClick={() => setPaying(true)}>
            <CheckCircle2 size={16} /> Record payment
          </button>
        )}
      />

      <div className="card hero">
        <div className="hero-main">
          <div className="hero-title"><span className="cell-money">{formatMoney(r.amount)}</span> <StatusBadge status={r.status} /></div>
          <p className="hero-sub">
            {isPaid
              ? `Paid on ${formatDate(r.paymentDate)} via ${r.paymentMethod}`
              : `${r.status === 'Overdue' ? 'Was due' : 'Due'} on ${formatDate(r.dueDate)}`}
          </p>
        </div>
      </div>

      <div className="grid-main-side">
        <Section title="Record details">
          <DetailList
            items={[
              { label: 'Billing month', value: formatMonth(r.billingMonth, 'long') },
              { label: 'Amount', value: formatMoney(r.amount) },
              { label: 'Due date', value: formatDate(r.dueDate) },
              { label: 'Status', value: <StatusBadge status={r.status} /> },
              { label: 'Payment date', value: r.paymentDate && formatDate(r.paymentDate) },
              { label: 'Payment method', value: r.paymentMethod },
              { label: 'Notes', value: r.notes },
              { label: 'Created', value: formatDateTime(r.createdAt) },
            ]}
          />
          {!canManage && !isPaid && (
            <p className="notice mt-20">
              <Info size={16} aria-hidden="true" />
              Pay your landlord as usual (cash, UPI or bank transfer). They will mark this record as paid once they receive it.
            </p>
          )}
        </Section>

        <Section title="Rental">
          <DetailList
            columns={1}
            items={[
              { label: 'Property', value: <Link to={`/properties/${r.propertyId}`} className="cell-link">{r.propertyName}</Link> },
              { label: 'Address', value: r.propertyAddress },
              { label: 'Tenant', value: canManage ? <Link to={`/tenants/${r.tenantId}`} className="cell-link">{r.tenantName}</Link> : r.tenantName },
              ...(canManage ? [{ label: 'Tenant contact', value: [r.tenantEmail, r.tenantPhone].filter(Boolean).join(' · ') }] : []),
              { label: 'Landlord', value: r.landlordName },
              { label: 'Rental', value: <Link to={`/rentals/${r.tenantPropertyId}`} className="cell-link">{r.assignmentStatus === 'Active' ? 'Active rental' : 'Ended rental'}</Link> },
            ]}
          />
        </Section>
      </div>

      <MarkPaidModal isOpen={paying} onClose={() => setPaying(false)} onPaid={reload} payment={r} />
    </div>
  );
}
