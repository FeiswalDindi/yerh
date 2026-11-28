import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import './laravel-notifications.css';
import { Link, Navigate } from 'react-router-dom';
import { useLaravelSession } from '../../app/useLaravelSession';
import { laravelRequest } from '../../services/laravel-api';
import { WorkspaceTable } from '../platform/workspace/WorkspaceControls';
import {
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from '../platform/server/WorkspaceActions';

type Inbox = {
  items: { id: string; message: string; url: string; read: boolean; received_at: string }[];
  unread: number;
};

async function inbox(signal: AbortSignal) {
  return (await laravelRequest<{ data: Inbox }>('/notifications', { signal })).data;
}

export function LaravelNotificationsLink() {
  const { records, reload } = useWorkspaceRecords(inbox);
  useEffect(() => {
    window.addEventListener('yerh:notifications-read', reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener('yerh:notifications-read', reload);
      window.removeEventListener('focus', reload);
    };
  }, [reload]);
  return (
    <Link
      to="/account/notifications"
      className="icon-button"
      aria-label={records?.unread ? 'Notifications, unread' : 'Notifications'}
    >
      <Bell size={19} aria-hidden="true" />
      {!!records?.unread && <span className="laravel-unread-dot" aria-hidden="true" />}
    </Link>
  );
}

export function LaravelNotifications() {
  const session = useLaravelSession();
  const isGuestOnly = Boolean(
    session?.profile && session.profile.role === 'guest' && session.profile.staff.length === 0,
  );
  const { records, reload, error } = useWorkspaceRecords(
    inbox,
    Boolean(session?.profile?.email_verified && !isGuestOnly),
  );
  const [busy, setBusy] = useState(false);

  if (isGuestOnly) {
    return <Navigate to="/account" replace />;
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await laravelRequest('/notifications/read-all', { method: 'POST' });
      reload();
      window.dispatchEvent(new Event('yerh:notifications-read'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container section">
      <h1>Notifications</h1>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="notifications"
          columns={['Notification', 'Received', 'Action']}
          actions={
            records.unread > 0 && (
              <button
                type="button"
                className="button button-outline workspace-action"
                disabled={busy}
                onClick={() => void markAllRead()}
              >
                {busy ? 'Marking…' : 'Mark all as read'}
              </button>
            )
          }
          rows={records.items.map((item) => ({
            id: item.id,
            search: item.message,
            cells: [
              item.url.startsWith('/api/') ? (
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.message}
                </a>
              ) : (
                <Link to={item.url}>{item.message}</Link>
              ),
              new Date(item.received_at).toLocaleDateString('en-KE'),
              !item.read ? (
                <WorkspaceAction
                  action="Mark as read"
                  submit="Mark as read"
                  save={async () => {
                    await laravelRequest('/notifications/' + item.id + '/read', { method: 'POST' });
                    reload();
                    window.dispatchEvent(new Event('yerh:notifications-read'));
                  }}
                >
                  <p>{item.message}</p>
                </WorkspaceAction>
              ) : (
                'Read'
              ),
            ],
          }))}
        />
      )}
    </section>
  );
}
