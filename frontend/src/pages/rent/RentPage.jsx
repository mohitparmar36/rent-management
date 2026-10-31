import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Plus, Receipt } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { FilterSelect, SearchInput, Tabs, Toolbar } from '../../components/common/Filters';
import { Section } from '../../components/common/Section';
import { EmptyState } from '../../components/common/States';
import MarkPaidModal from '../../components/rent/MarkPaidModal';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import useListParams from '../../hooks/useListParams';
import { getProperties, getRentPayments, getRentSummary } from '../../services/api.service';
import { formatDate, formatMoney, formatMonth } from '../../utils/format';

export default function RentPage() {
  const { user } = useAuth();
  const canManage = user.role !== 'Tenant';
  const { params, setParam, setSort, clear, hasFilters } = useListParams();
  const [paying, setPaying] = useState(null);
  const [properties, setProperties] = useState([]);

  // Totals use the same filters as the list except status, paging and sorting,
  // so all three buckets stay visible whichever tab is selected
  const { status } = params;
  const filters = Object.fromEntries(
    Object.entries(params).filter(([key]) => !['status', 'page', 'pageSize', 'sortBy', 'sortDir'].includes(key)),
  );
  const filterKey = JSON.stringify(filters);

  const list = useAsync(() => getRentPayments(params), [params]);
  const summary = useAsync(() => getRentSummary(filters), [filterKey]);

  useEffect(() => {
    if (!canManage) return;
    getProperties({ pageSize: 100, sortBy: 'name' }).then((p) => setProperties(p.items)).catch(() => setProperties([]));
  }, [canManage]);

  function refreshAll() {
    list.reload({ silent: true });
    summary.reload({ silent: true });
  }

  const s = summary.data;
  const tabs = [
    { value: '', label: 'All' },
    { value: 'Overdue', label: 'Overdue', count: s?.overdueCount },
    { value: 'Pending', label: 'Pending', count: s?.pendingCount },
    { value: 'Paid', label: 'Payment history', count: s?.paidCount },
  ];

  const columns = [
    {
      key: 'month', header: 'Month', sortKey: 'month',
      render: (r) => <Link to={`/rent/${r.paymentId}`} className="cell-link">{formatMonth(r.billingMonth)}</Link>,
    },
    ...(canManage ? [{
      key: 'tenant', header: 'Tenant', sortKey: 'tenant',
      render: (r) => (
        <>
          <span className="cell-primary">{r.tenantName}</span>
          <span className="cell-sub">{r.propertyName}</span>
        </>
      ),
    }] : [{ key: 'property', header: 'Property', render: (r) => r.propertyName }]),
    { key: 'due', header: 'Due date', sortKey: 'dueDate', render: (r) => formatDate(r.dueDate) },
    { key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right', render: (r) => <span className="cell-money">{formatMoney(r.amount)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'paid', header: 'Paid', hideOnMobile: true,
      render: (r) => (r.paymentDate ? (
        <>
          {formatDate(r.paymentDate)}
          <span className="cell-sub">{r.paymentMethod}</span>
        </>
      ) : <span className="cell-muted">—</span>),
    },
    ...(canManage ? [{
      key: 'actions', header: '', align: 'right',
      render: (r) => r.status !== 'Paid' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPaying(r)}>Record payment</button>
      ),
    }] : []),
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title={canManage ? 'Rent' : 'My rent'}
        subtitle={canManage
          ? 'Monthly rent records for your rentals. Record payments here as you receive them.'
          : 'Your rent records and payment history. Contact your landlord if something looks wrong.'}
        actions={canManage && <Link to="/rent/new" className="btn btn-primary"><Plus size={16} /> Add rent record</Link>}
      />

      <div className="stat-grid">
        <StatCard label="Collected" icon={CheckCircle2} tone="success" value={s ? formatMoney(s.totalCollected) : '…'}
          hint={s && `${s.paidCount} paid`} />
        <StatCard label="Pending" icon={Clock} tone="warning" value={s ? formatMoney(s.pendingAmount) : '…'}
          hint={s && `${s.pendingCount} not yet due`} />
        <StatCard label="Overdue" icon={AlertCircle} tone="danger" value={s ? formatMoney(s.overdueAmount) : '…'}
          hint={s && `${s.overdueCount} past due date`} />
      </div>

      <Section flush>
        <Tabs label="Filter by status" tabs={tabs} value={status ?? ''} onChange={(v) => setParam('status', v)} />
        <Toolbar showClear={hasFilters} onClear={clear}>
          {canManage && (
            <SearchInput value={params.search ?? ''} onChange={(v) => setParam('search', v)} placeholder="Search tenant or property" />
          )}
          {canManage && (
            <FilterSelect label="Property" value={params.propertyId} onChange={(v) => setParam('propertyId', v)}
              options={properties.map((p) => ({ value: String(p.propertyId), label: p.propertyName }))} />
          )}
          <label className="filter-select">
            <span className="sr-only">Billing month</span>
            <input type="month" className={`input${params.billingMonth ? '' : ' input-empty'}`} value={params.billingMonth ?? ''}
              aria-label="Billing month" title="Filter by billing month"
              onChange={(e) => setParam('billingMonth', e.target.value)} />
          </label>
        </Toolbar>

        <DataTable
          caption="Rent records"
          columns={columns}
          rows={list.data?.items}
          rowKey={(r) => r.paymentId}
          rowLink={(r) => `/rent/${r.paymentId}`}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={params}
          onSort={setSort}
          empty={
            <EmptyState icon={Receipt} compact
              title={hasFilters ? 'No rent records match' : 'No rent records yet'}
              description={hasFilters ? 'Try a different filter.' : canManage ? 'Create a rent record for one of your active rentals.' : 'Your landlord has not added any rent yet.'}
              action={canManage && !hasFilters && <Link to="/rent/new" className="btn btn-primary btn-sm"><Plus size={15} /> Add rent record</Link>}
            />
          }
        />
        <Pagination result={list.data} onPageChange={(p) => setParam('page', p)} />
      </Section>

      <MarkPaidModal isOpen={Boolean(paying)} onClose={() => setPaying(null)} onPaid={refreshAll} payment={paying} />
    </div>
  );
}
