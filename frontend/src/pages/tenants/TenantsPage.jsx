import { Link } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
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
import { getTenants } from '../../services/api.service';
import { formatDate, initials } from '../../utils/format';

const TABS = [
  { value: '', label: 'All tenants' },
  { value: 'Housed', label: 'Currently renting' },
  { value: 'Unassigned', label: 'Not renting' },
];

export default function TenantsPage() {
  const { user } = useAuth();
  const { params, setParam, setSort, clear, hasFilters } = useListParams();
  const { data, loading, error, reload } = useAsync(() => getTenants(params), [params]);

  const columns = [
    {
      key: 'name', header: 'Tenant', sortKey: 'name',
      render: (t) => (
        <span className="person">
          <span className="avatar" aria-hidden="true">{initials(t)}</span>
          <span>
            <Link to={`/tenants/${t.userId}`} className="cell-link">{t.firstName} {t.lastName}</Link>
            <span className="cell-sub">{t.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'phone', header: 'Phone', render: (t) => t.phoneNumber ?? <span className="cell-muted">—</span>, hideOnMobile: true },
    {
      key: 'property', header: 'Current property', sortKey: 'property',
      render: (t) => (t.currentPropertyId ? (
        <>
          <Link to={`/properties/${t.currentPropertyId}`} className="cell-link">{t.currentPropertyName}</Link>
          <span className="cell-sub">since {formatDate(t.currentStartDate)}</span>
        </>
      ) : <span className="cell-muted">Not renting</span>),
    },
    { key: 'rentals', header: 'Rentals', align: 'right', render: (t) => t.assignmentCount, hideOnMobile: true },
    { key: 'account', header: 'Account', render: (t) => <StatusBadge status={t.isActive ? 'Active' : 'Inactive'} /> },
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Tenants"
        subtitle={user.role === 'Admin' ? 'Every tenant account.' : 'People who rent, or have rented, your properties.'}
        actions={<Link to="/tenants/new" className="btn btn-primary"><UserPlus size={16} /> Add tenant</Link>}
      />

      <Section flush>
        <Tabs label="Filter tenants" tabs={TABS} value={params.status ?? ''} onChange={(v) => setParam('status', v)} />
        <Toolbar showClear={hasFilters} onClear={clear}>
          <SearchInput value={params.search ?? ''} onChange={(v) => setParam('search', v)} placeholder="Search name or email" />
        </Toolbar>
        <DataTable
          caption="Tenants"
          columns={columns}
          rows={data?.items}
          rowKey={(t) => t.userId}
          rowLink={(t) => `/tenants/${t.userId}`}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={params}
          onSort={setSort}
          empty={
            <EmptyState icon={Users} compact
              title={hasFilters ? 'No tenants match' : 'No tenants yet'}
              description={hasFilters ? 'Try a different search or filter.' : 'Add a tenant and assign them to one of your properties.'}
              action={!hasFilters && <Link to="/tenants/new" className="btn btn-primary btn-sm"><UserPlus size={15} /> Add tenant</Link>}
            />
          }
        />
        <Pagination result={data} onPageChange={(p) => setParam('page', p)} />
      </Section>
    </div>
  );
}
