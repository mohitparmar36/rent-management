import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, PlayCircle, RotateCcw } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { DetailList, Section } from '../../components/common/Section';
import { ErrorState, PageSkeleton } from '../../components/common/States';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { getComplaint, updateComplaintStatus } from '../../services/api.service';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';

/** The status changes a landlord/admin can make from each status. */
const ACTIONS = {
  Open: [{ status: 'In Progress', label: 'Start work', icon: PlayCircle, primary: false }, { status: 'Resolved', label: 'Mark resolved', icon: CheckCircle2, primary: true }],
  'In Progress': [{ status: 'Resolved', label: 'Mark resolved', icon: CheckCircle2, primary: true }],
  Resolved: [{ status: 'Open', label: 'Reopen', icon: RotateCcw, primary: false }],
};

export default function ComplaintDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = user.role !== 'Tenant';
  const { data: c, loading, error, reload } = useAsync(() => getComplaint(id), [id]);
  const [busy, setBusy] = useState(null);

  if (loading && !c) return <PageSkeleton cards={0} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  async function changeStatus(status) {
    if (status === 'Open') {
      const ok = await confirm({
        title: 'Reopen this complaint?',
        message: 'It will move back to Open and the resolved date will be cleared. The tenant will be notified.',
        confirmText: 'Reopen',
      });
      if (!ok) return;
    }
    setBusy(status);
    try {
      await updateComplaintStatus(id, status);
      toast.success(`Complaint marked ${status}. The tenant has been notified.`);
      reload({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const timeline = [
    { title: 'Reported', time: c.createdAt, done: true },
    // Only the latest change has a timestamp, so "In progress" shows a time only while it is the current step
    { title: 'In progress', time: c.status === 'In Progress' ? c.updatedAt : null, done: c.status !== 'Open' },
    { title: 'Resolved', time: c.resolvedAt, done: c.status === 'Resolved' },
  ];

  return (
    <div className="fade-in-up">
      <PageHeader
        title={c.title}
        breadcrumbs={[{ label: 'Complaints', to: '/complaints' }]}
        actions={canManage && ACTIONS[c.status].map(({ status, label, icon: Icon, primary }) => (
          <button key={status} type="button" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => changeStatus(status)} disabled={Boolean(busy)}>
            {busy === status ? <span className="spinner" aria-hidden="true" /> : <Icon size={16} />} {label}
          </button>
        ))}
      />

      <div className="grid-main-side">
        <div className="stack">
          <Section title="Description">
            <div className="choice-group mb-20">
              <StatusBadge status={c.status} />
              <StatusBadge status={c.priority} label={`${c.priority} priority`} />
              <span className="badge badge-neutral">{c.categoryName}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.description}</p>
          </Section>

          <Section title="Details">
            <DetailList
              items={[
                { label: 'Property', value: <Link to={`/properties/${c.propertyId}`} className="cell-link">{c.propertyName}</Link> },
                { label: 'Address', value: c.propertyAddress },
                { label: 'Reported by', value: canManage ? <Link to={`/tenants/${c.tenantId}`} className="cell-link">{c.tenantName}</Link> : c.tenantName },
                ...(canManage ? [{ label: 'Tenant contact', value: [c.tenantEmail, c.tenantPhone].filter(Boolean).join(' · ') }] : []),
                { label: 'Landlord', value: c.landlordName },
                { label: 'Last updated', value: formatDateTime(c.updatedAt) },
              ]}
            />
          </Section>
        </div>

        <Section title="Progress">
          <ol className="timeline">
            {timeline.map((step) => (
              <li key={step.title} className={step.done ? 'done' : undefined}>
                <div className="timeline-title">{step.title}</div>
                <div className="timeline-time">{step.done ? (step.time ? formatDateTime(step.time) : 'Done') : 'Not yet'}</div>
              </li>
            ))}
          </ol>
          {!canManage && c.status !== 'Resolved' && (
            <p className="notice">Your landlord updates this as work progresses. You&apos;ll get a notification at each step.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
