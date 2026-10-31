import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Power } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { DetailList, Section } from '../../components/common/Section';
import { ErrorState, PageSkeleton } from '../../components/common/States';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { getUser, setUserActive } from '../../services/api.service';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime, initials } from '../../utils/format';
import UserFormModal from './UserFormModal';

export default function UserDetailsPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: u, loading, error, reload } = useAsync(() => getUser(id), [id]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !u) return <PageSkeleton cards={0} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const isSelf = u.userId === me.userId;
  const name = `${u.firstName} ${u.lastName}`;

  async function toggleActive() {
    const activating = !u.isActive;
    const ok = await confirm({
      title: activating ? `Activate ${name}?` : `Deactivate ${name}?`,
      message: activating
        ? 'They will be able to sign in again.'
        : 'They will be signed out immediately and cannot sign in until reactivated. Their records are kept.',
      confirmText: activating ? 'Activate' : 'Deactivate',
      danger: !activating,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await setUserActive(u.userId, activating);
      toast.success(activating ? 'Account activated.' : 'Account deactivated.');
      reload({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const roleLinks = {
    Landlord: { label: 'Properties owned', value: <Link to={`/properties?landlordId=${u.userId}`} className="cell-link">{u.propertyCount}</Link> },
    Tenant: { label: 'Current property', value: u.currentPropertyName ?? 'Not renting' },
  };

  return (
    <div className="fade-in-up">
      <PageHeader
        title={name}
        breadcrumbs={[{ label: 'Users', to: '/users' }]}
        actions={
          <>
            {!isSelf && (
              <button type="button" className={`btn btn-ghost${u.isActive ? ' btn-danger-text' : ''}`} onClick={toggleActive} disabled={busy}>
                <Power size={16} /> {u.isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</button>
          </>
        }
      />

      <div className="card hero">
        <span className="avatar avatar-lg" aria-hidden="true">{initials(u)}</span>
        <div className="hero-main">
          <div className="hero-title">
            {name}
            <StatusBadge status={u.role} />
            <StatusBadge status={u.isActive ? 'Active' : 'Inactive'} label={u.isActive ? 'Active' : 'Deactivated'} />
          </div>
          <p className="hero-sub">{u.email}{isSelf && ' · This is you'}</p>
        </div>
      </div>

      <Section title="Account details">
        <DetailList
          items={[
            { label: 'Email', value: u.email },
            { label: 'Phone', value: u.phoneNumber },
            { label: 'Role', value: u.role },
            ...(roleLinks[u.role] ? [roleLinks[u.role]] : []),
            ...(u.role === 'Tenant' ? [{ label: 'Complaints raised', value: u.complaintCount }] : []),
            { label: 'Last sign-in', value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never' },
            { label: 'Created', value: formatDateTime(u.createdAt) },
            { label: 'Last updated', value: formatDateTime(u.updatedAt) },
          ]}
        />
        {u.role === 'Tenant' && (
          <div className="mt-20"><Link to={`/tenants/${u.userId}`} className="btn btn-ghost btn-sm">Open tenant record</Link></div>
        )}
      </Section>

      <UserFormModal isOpen={editing} onClose={() => setEditing(false)} onSaved={() => reload({ silent: true })} user={u} />
    </div>
  );
}
