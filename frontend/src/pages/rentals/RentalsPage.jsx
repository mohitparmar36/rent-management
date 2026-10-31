import { Link } from 'react-router-dom';
import { ClipboardList, Home } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { SearchInput, Tabs, Toolbar } from '../../components/common/Filters';
import { Section } from '../../components/common/Section';
import { EmptyState } from '../../components/common/States';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import useListParams from '../../hooks/useListParams';
import { getRentals } from '../../services/api.service';
import { formatDate, formatMoney } from '../../utils/format';

const TABS = [
  { value: '', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Ended' },
];

/** Rental assignments. Tenants see this page as "My home". */
export default function RentalsPage() {
  const { user } = useAuth();
  const isTenant = user.role === 'Tenant';
  const { params, setParam, setSort, clear, hasFilters } = useListParams();
  const { data, loading, error, reload } = useAsync(() => getRentals(params), [params]);

  const columns = [
    {
      key: 'property', header: 'Property', sortKey: 'property',
      render: (a) => (
        <>
          <Link to={`/rentals/${a.tenantPropertyId}`} className="cell-link">{a.propertyName}</Link>
          <span className="cell-sub">{a.propertyAddress}</span>
        </>
      ),
    },
    isTenant
      ? { key: 'landlord', header: 'Landlord', render: (a) => a.landlordName }
      : { key: 'tenant', header: 'Tenant', sortKey: 'tenant', render: (a) => <Link to={`/tenants/${a.tenantId}`} className="cell-link">{a.tenantName}</Link> },
    { key: 'rent', header: 'Monthly rent', align: 'right', render: (a) => <span className="cell-money">{formatMoney(a.monthlyRent)}</span> },
    { key: 'start', header: 'Start', sortKey: 'startDate', render: (a) => formatDate(a.startDate) },
    { key: 'end', header: 'End', render: (a) => (a.endDate ? formatDate(a.endDate) : <span className="cell-muted">Open-ended</span>) },
    { key: 'status', header: 'Status', sortKey: 'status', render: (a) => <StatusBadge status={a.status} label={a.status === 'Completed' ? 'Ended' : a.status} /> },
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title={isTenant ? 'My home' : 'Rentals'}
        subtitle={isTenant
          ? 'The property you rent now and the ones you have rented before.'
          : 'Who is renting which property. To start a rental, open a vacant property or a tenant and choose “Assign”.'}
      />

      <Section flush>
        {!isTenant && (
          <>
            <Tabs label="Filter rentals" tabs={TABS} value={params.status ?? ''} onChange={(v) => setParam('status', v)} />
            <Toolbar showClear={hasFilters} onClear={clear}>
              <SearchInput value={params.search ?? ''} onChange={(v) => setParam('search', v)} placeholder="Search tenant or property" />
            </Toolbar>
          </>
        )}
        <DataTable
          caption="Rentals"
          columns={columns}
          rows={data?.items}
          rowKey={(a) => a.tenantPropertyId}
          rowLink={(a) => `/rentals/${a.tenantPropertyId}`}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={params}
          onSort={setSort}
          empty={
            isTenant ? (
              <EmptyState icon={Home} title="You're not renting through RentEase yet"
                description="When your landlord assigns you to a property it will appear here." compact />
            ) : (
              <EmptyState icon={ClipboardList} compact title={hasFilters ? 'No rentals match' : 'No rentals yet'}
                description={hasFilters ? 'Try a different search or filter.' : 'Assign a tenant to a vacant property to create a rental.'}
                action={!hasFilters && <Link to="/properties?status=Available" className="btn btn-primary btn-sm">View vacant properties</Link>} />
            )
          }
        />
        <Pagination result={data} onPageChange={(p) => setParam('page', p)} />
      </Section>
    </div>
  );
}
