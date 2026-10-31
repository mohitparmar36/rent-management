import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Pencil, Receipt, Trash2, UserMinus, UserPlus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import DataTable from '../../components/common/DataTable';
import { DetailList, Section } from '../../components/common/Section';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/common/States';
import { AssignRentalModal, EndRentalModal } from '../../components/rentals/RentalModals';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { deleteProperty, getProperty } from '../../services/api.service';
import { getErrorMessage } from '../../utils/errors';
import { formatDate, formatMoney, formatMonth } from '../../utils/format';

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const canManage = user.role !== 'Tenant';

  const { data: p, loading, error, reload } = useAsync(() => getProperty(id), [id]);
  const [modal, setModal] = useState(null); // 'assign' | 'end'

  if (loading && !p) return <PageSkeleton cards={0} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const lease = p.currentAssignment;

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this property?',
      message: `"${p.propertyName}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete property',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProperty(id);
      toast.success('Property deleted.');
      navigate('/properties', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const rentColumns = [
    { key: 'month', header: 'Month', render: (r) => <Link to={`/rent/${r.paymentId}`} className="cell-link">{formatMonth(r.billingMonth, 'long')}</Link> },
    { key: 'tenant', header: 'Tenant', render: (r) => r.tenantName, hideOnMobile: true },
    { key: 'due', header: 'Due', render: (r) => formatDate(r.dueDate) },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="cell-money">{formatMoney(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title={p.propertyName}
        breadcrumbs={canManage ? [{ label: 'Properties', to: '/properties' }] : [{ label: 'My home', to: '/rentals' }]}
        actions={
          canManage && (
            <>
              {p.canDelete && (
                <button type="button" className="btn btn-ghost btn-danger-text" onClick={handleDelete}>
                  <Trash2 size={16} /> Delete
                </button>
              )}
              <Link to={`/properties/${id}/edit`} className="btn btn-ghost"><Pencil size={16} /> Edit</Link>
              {lease ? (
                <Link to={`/rent/new?rental=${lease.tenantPropertyId}`} className="btn btn-primary"><Receipt size={16} /> Add rent</Link>
              ) : (
                p.status === 'Available' && (
                  <button type="button" className="btn btn-primary" onClick={() => setModal('assign')}>
                    <UserPlus size={16} /> Assign tenant
                  </button>
                )
              )}
            </>
          )
        }
      />

      <div className="card hero">
        <span className="hero-icon" aria-hidden="true"><Building2 size={26} /></span>
        <div className="hero-main">
          <div className="hero-title">{p.propertyType} <StatusBadge status={p.status} /></div>
          <p className="hero-sub">{p.address}, {p.city}, {p.state} {p.postalCode}</p>
        </div>
        <div className="hero-figures">
          <div className="hero-figure"><span>Monthly rent</span><strong>{formatMoney(p.monthlyRent)}</strong></div>
          <div className="hero-figure"><span>Collected</span><strong>{formatMoney(p.rentSummary.totalCollected)}</strong></div>
          <div className="hero-figure"><span>Outstanding</span><strong>{formatMoney(p.rentSummary.pendingAmount + p.rentSummary.overdueAmount)}</strong></div>
        </div>
      </div>

      {canManage && p.status === 'Maintenance' && (
        <div className="form-banner warning mb-20">This property is under maintenance. Edit it and set the status to Available before assigning a tenant.</div>
      )}

      <div className="grid-main-side">
        <div className="stack">
          <Section
            title="Recent rent"
            flush
            actions={<Link to={`/rent?propertyId=${id}`} className="btn btn-link btn-sm">All rent records</Link>}
          >
            <DataTable
              columns={rentColumns}
              rows={p.recentRent}
              rowKey={(r) => r.paymentId}
              rowLink={(r) => `/rent/${r.paymentId}`}
              empty={<EmptyState icon={Receipt} title="No rent records yet" compact
                description={lease && canManage ? 'Add the first month’s rent for this tenant.' : undefined} />}
            />
          </Section>

          {canManage && (
            <Section title="Rental history" description="Previous tenants of this property." flush>
              <DataTable
                columns={[
                  { key: 'tenant', header: 'Tenant', render: (a) => <Link to={`/rentals/${a.tenantPropertyId}`} className="cell-link">{a.tenantName}</Link> },
                  { key: 'from', header: 'From', render: (a) => formatDate(a.startDate) },
                  { key: 'to', header: 'To', render: (a) => formatDate(a.endDate) },
                  { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
                ]}
                rows={p.assignmentHistory}
                rowKey={(a) => a.tenantPropertyId}
                rowLink={(a) => `/rentals/${a.tenantPropertyId}`}
                empty={<EmptyState title="No previous tenants" compact />}
              />
            </Section>
          )}
        </div>

        <div className="stack">
          <Section
            title={canManage ? 'Current tenant' : 'Your rental'}
            actions={canManage && lease && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('end')}>
                <UserMinus size={15} /> End rental
              </button>
            )}
          >
            {lease ? (
              <DetailList
                columns={1}
                items={[
                  { label: 'Tenant', value: canManage ? <Link to={`/tenants/${lease.tenantId}`} className="cell-link">{lease.tenantName}</Link> : lease.tenantName },
                  { label: 'Email', value: lease.tenantEmail },
                  { label: 'Phone', value: lease.tenantPhone },
                  { label: 'Since', value: formatDate(lease.startDate) },
                  { label: 'Until', value: lease.endDate ? formatDate(lease.endDate) : 'Open-ended' },
                ]}
              />
            ) : (
              <EmptyState icon={UserPlus} title="Vacant" compact
                description={p.status === 'Available' && canManage ? 'Assign a tenant to start collecting rent.' : undefined} />
            )}
          </Section>

          <Section title="Details">
            <DetailList
              columns={1}
              items={[
                { label: 'Landlord', value: p.landlordName },
                { label: 'Landlord contact', value: [p.landlordEmail, p.landlordPhone].filter(Boolean).join(' · ') },
                { label: 'Open complaints', value: canManage ? <Link to={`/complaints?propertyId=${id}`} className="cell-link">{p.openComplaints}</Link> : p.openComplaints },
                { label: 'Description', value: p.description },
                { label: 'Added', value: formatDate(p.createdAt) },
              ]}
            />
          </Section>
        </div>
      </div>

      <AssignRentalModal isOpen={modal === 'assign'} onClose={() => setModal(null)} onAssigned={reload} property={p} />
      <EndRentalModal isOpen={modal === 'end'} onClose={() => setModal(null)} onEnded={reload}
        rental={lease && { ...lease, propertyName: p.propertyName }} />
    </div>
  );
}
