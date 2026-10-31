import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { FilterSelect, SearchInput, Tabs, Toolbar } from '../../components/common/Filters';
import { Section } from '../../components/common/Section';
import { EmptyState } from '../../components/common/States';
import { useAuth } from '../../context/AuthContext';
import useAsync from '../../hooks/useAsync';
import useListParams from '../../hooks/useListParams';
import { getProperties } from '../../services/api.service';
import { PROPERTY_TYPES } from '../../utils/constants';
import { formatMoney } from '../../utils/format';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'Available', label: 'Available' },
  { value: 'Occupied', label: 'Occupied' },
  { value: 'Maintenance', label: 'Maintenance' },
];

export default function PropertiesPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'Admin';
  const { params, setParam, setSort, clear, hasFilters } = useListParams();
  const { data, loading, error, reload } = useAsync(() => getProperties(params), [params]);

  const columns = [
    {
      key: 'name', header: 'Property', sortKey: 'name',
      render: (p) => (
        <>
          <Link to={`/properties/${p.propertyId}`} className="cell-link">{p.propertyName}</Link>
          <span className="cell-sub">{p.address}</span>
        </>
      ),
    },
    { key: 'type', header: 'Type', render: (p) => p.propertyType, hideOnMobile: true },
    { key: 'city', header: 'City', sortKey: 'city', render: (p) => `${p.city}, ${p.state}` },
    { key: 'rent', header: 'Monthly rent', sortKey: 'rent', align: 'right', render: (p) => <span className="cell-money">{formatMoney(p.monthlyRent)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'tenant', header: 'Tenant', render: (p) => p.currentTenantName ?? <span className="cell-muted">Vacant</span> },
    ...(isAdmin ? [{ key: 'landlord', header: 'Landlord', render: (p) => p.landlordName, hideOnMobile: true }] : []),
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Properties"
        subtitle={isAdmin ? 'Every property on RentEase.' : 'The properties you own and let.'}
        actions={<Link to="/properties/new" className="btn btn-primary"><Plus size={16} /> Add property</Link>}
      />

      <Section flush>
        <Tabs label="Filter by status" tabs={STATUS_TABS} value={params.status ?? ''} onChange={(v) => setParam('status', v)} />
        <Toolbar showClear={hasFilters} onClear={clear}>
          <SearchInput value={params.search ?? ''} onChange={(v) => setParam('search', v)} placeholder="Search name, address or city" />
          <FilterSelect label="Type" value={params.type} onChange={(v) => setParam('type', v)} options={PROPERTY_TYPES} />
        </Toolbar>

        <DataTable
          caption="Properties"
          columns={columns}
          rows={data?.items}
          rowKey={(p) => p.propertyId}
          rowLink={(p) => `/properties/${p.propertyId}`}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={params}
          onSort={setSort}
          empty={
            hasFilters ? (
              <EmptyState icon={Building2} title="No properties match" description="Try a different search or filter."
                action={<button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear filters</button>} compact />
            ) : (
              <EmptyState icon={Building2} title="No properties yet" description="Add your first property to start tracking tenants and rent."
                action={<Link to="/properties/new" className="btn btn-primary btn-sm"><Plus size={15} /> Add property</Link>} compact />
            )
          }
        />
        <Pagination result={data} onPageChange={(p) => setParam('page', p)} />
      </Section>
    </div>
  );
}
