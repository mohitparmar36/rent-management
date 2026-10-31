import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { Tabs } from '../../components/common/Filters';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, Spinner } from '../../components/common/States';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import useListParams from '../../hooks/useListParams';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/api.service';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime, formatRelative } from '../../utils/format';

export default function NotificationsPage() {
  const toast = useToast();
  const { params, setParam } = useListParams({ pageSize: 15 });
  const { data, loading, error, reload, setData } = useAsync(() => getNotifications(params), [params]);
  const [busy, setBusy] = useState(false);

  async function markOne(n) {
    if (n.isRead) return;
    // Update the screen immediately; reload if the server disagrees
    setData({
      ...data,
      unreadCount: Math.max(0, data.unreadCount - 1),
      items: data.items.map((x) => (x.notificationId === n.notificationId ? { ...x, isRead: true } : x)),
    });
    try {
      await markNotificationRead(n.notificationId);
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload({ silent: true });
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      toast.success('All notifications marked as read.');
      reload({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const unreadOnly = params.unreadOnly === 'true';

  return (
    <div className="fade-in-up">
      <PageHeader
        title="Notifications"
        subtitle="Updates about rent, rentals and complaints."
        actions={data?.unreadCount > 0 && (
          <button type="button" className="btn btn-ghost" onClick={markAll} disabled={busy}>
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      />

      <Section flush>
        <Tabs
          label="Filter notifications"
          value={unreadOnly ? 'true' : ''}
          onChange={(v) => setParam('unreadOnly', v)}
          tabs={[{ value: '', label: 'All' }, { value: 'true', label: 'Unread', count: data?.unreadCount }]}
        />

        {error && <ErrorState message={error} onRetry={reload} compact />}
        {loading && !data && <Spinner />}

        {data && data.items.length === 0 && (
          <EmptyState icon={Bell} compact
            title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            description={unreadOnly ? "You're all caught up." : 'You will be notified about rent, rentals and complaints here.'} />
        )}

        {data && data.items.length > 0 && (
          <ul className="item-list" style={{ borderTop: '1px solid var(--color-border)' }}>
            {data.items.map((n) => (
              <li key={n.notificationId}>
                <button
                  type="button"
                  className={`notif-row${n.isRead ? '' : ' unread'}`}
                  style={{ padding: '14px 22px 14px 36px' }}
                  onClick={() => markOne(n)}
                  title={n.isRead ? formatDateTime(n.createdAt) : 'Mark as read'}
                >
                  {!n.isRead && <span className="unread-dot" style={{ left: 18, top: 21 }} aria-label="Unread" />}
                  <span className="notif-row-title">{n.title}</span>
                  <span className="notif-row-message">{n.message}</span>
                  <span className="notif-row-time">{formatRelative(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Pagination result={data} onPageChange={(p) => setParam('page', p)} />
      </Section>
    </div>
  );
}
