import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCog, UserPlus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { FilterSelect, SearchInput, Tabs, Toolbar } from '../../components/common/Filters';
import { Section } from '../../components/common/Section';
import { EmptyState } from '../../components/common/States';
import useAsync from '../../hooks/useAsync';
import useListParams from '../../hooks/useListParams';
import { getUsers } from '../../services/api.service';
import { ROLES } from '../../utils/constants';
import { formatDate, formatRelative, initials } from '../../utils/format';
import UserFormModal from './UserFormModal';

const ROLE_TABS = [{ value: '', label: 'All users' }, ...ROLES.map((r) => ({ value: r, label: `${r}s` }))];

export default function UsersPage() {
  const navigate = useNavigate();
  const { params, setParam, setSort, clear, hasFilters } = useListParams();
  const { data, loading, error, reload } = useAsync(() => getUsers(params), [params]);
  const [creating, setCreating] = useState(false);

  const columns = [
    {
      key: 'name', header: 'User', sortKey: 'name',
      render: (u) => (
        <span className="person">
          <span className="avatar" aria-hidden="true">{initials(u)}</span>
          <span>
            <Link to={`/users/${u.userId}`} className="cell-link">{u.firstName} {u.lastName}</Link>
            <span className="cell-sub">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', sortKey: 'role', render: (u) => <StatusBadge status={u.role} /> },
    { key: 'phone', header: 'Phone', render: (u) => u.phoneNumber ?? <span className="cell-muted">—</span>, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.isActive ? 'Active' : 'Inactive'} /> },
    { key: 'lastLogin', header: 'Last sign-in', sortKey: 'lastLogin', render: (u) => (u.lastLoginAt ? formatRelative(u.lastLoginAt) : <span className="cell-muted">Never</span>) },
    { key: 'created', header: 'Created', sortKey: 'createdAt', render: (u) => formatDate(u.createdAt), hideOnMobile: true },
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Users"
        subtitle="Create accounts, update details and control who can sign in."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><UserPlus size={16} /> Create user</button>}
      />

      <Section flush>
        <Tabs label="Filter by role" tabs={ROLE_TABS} value={params.role ?? ''} onChange={(v) => setParam('role', v)} />
        <Toolbar showClear={hasFilters} onClear={clear}>
          <SearchInput value={params.search ?? ''} onChange={(v) => setParam('search', v)} placeholder="Search name or email" />
          <FilterSelect label="Status" value={params.isActive} onChange={(v) => setParam('isActive', v)}
            options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Deactivated' }]} />
        </Toolbar>
        <DataTable
          caption="Users"
          columns={columns}
          rows={data?.items}
          rowKey={(u) => u.userId}
          rowLink={(u) => `/users/${u.userId}`}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={params}
          onSort={setSort}
          empty={<EmptyState icon={UserCog} title="No users match" description="Try a different search or filter." compact />}
        />
        <Pagination result={data} onPageChange={(p) => setParam('page', p)} />
      </Section>

      <UserFormModal isOpen={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/users/${id}`)} user={null} />
    </div>
  );
}
