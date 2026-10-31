import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Wrench } from 'lucide-react';
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
import { getComplaintCategories, getComplaints } from '../../services/api.service';
import { COMPLAINT_PRIORITIES } from '../../utils/constants';
import { formatRelative } from '../../utils/format';

const TABS = [
  { value: '', label: 'All' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In progress' },
  { value: 'Resolved', label: 'Resolved' },
];

export default function ComplaintsPage() {
  const { user } = useAuth();
  const isTenant = user.role === 'Tenant';
  const { params, setParam, setSort, clear, hasFilters } = useListParams();
  const { data, loading, error, reload } = useAsync(() => getComplaints(params), [params]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getComplaintCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const columns = [
    {
      key: 'title', header: 'Issue', sortKey: 'title',
      render: (c) => (
        <>
          <Link to={`/complaints/${c.complaintId}`} className="cell-link">{c.title}</Link>
          <span className="cell-sub">{c.categoryName}</span>
        </>
      ),
    },
    {
      key: 'property', header: isTenant ? 'Property' : 'Property & tenant', sortKey: 'property',
      render: (c) => (
        <>
          {c.propertyName}
          {!isTenant && <span className="cell-sub">{c.tenantName}</span>}
        </>
      ),
    },
    { key: 'priority', header: 'Priority', sortKey: 'priority', render: (c) => <StatusBadge status={c.priority} /> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'created', header: 'Reported', sortKey: 'createdAt', render: (c) => formatRelative(c.createdAt) },
    { key: 'updated', header: 'Last update', sortKey: 'updatedAt', render: (c) => formatRelative(c.updatedAt), hideOnMobile: true },
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Complaints"
        subtitle={isTenant ? 'Maintenance issues you have reported and their progress.' : 'Maintenance issues reported by tenants.'}
        actions={isTenant && <Link to="/complaints/new" className="btn btn-primary"><Plus size={16} /> Report an issue</Link>}
      />

      <Section flush>
        <Tabs label="Filter by status" tabs={TABS} value={params.status ?? ''} onChange={(v) => setParam('status', v)} />
        <Toolbar showClear={hasFilters} onClear={clear}>
          <SearchInput value={params.search ?? ''} onChange={(v) => setParam('search', v)}
            placeholder={isTenant ? 'Search issues' : 'Search issue, property or tenant'} />
          <FilterSelect label="Priority" value={params.priority} onChange={(v) => setParam('priority', v)} options={COMPLAINT_PRIORITIES} />
          <FilterSelect label="Category" value={params.categoryId} onChange={(v) => setParam('categoryId', v)}
            options={categories.map((c) => ({ value: String(c.categoryId), label: c.categoryName }))} />
        </Toolbar>

        <DataTable
          caption="Complaints"
          columns={columns}
          rows={data?.items}
          rowKey={(c) => c.complaintId}
          rowLink={(c) => `/complaints/${c.complaintId}`}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={params}
          onSort={setSort}
          empty={
            <EmptyState icon={Wrench} compact
              title={hasFilters ? 'No complaints match' : 'No complaints'}
              description={hasFilters ? 'Try a different filter.' : isTenant ? 'If something needs fixing at home, report it here.' : 'Your tenants have not reported any issues.'}
              action={isTenant && !hasFilters && <Link to="/complaints/new" className="btn btn-primary btn-sm"><Plus size={15} /> Report an issue</Link>}
            />
          }
        />
        <Pagination result={data} onPageChange={(p) => setParam('page', p)} />
      </Section>
    </div>
  );
}
