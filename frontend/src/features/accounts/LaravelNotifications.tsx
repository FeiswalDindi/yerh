import { Bell } from 'lucide-react';
import { useEffect } from 'react';
import './laravel-notifications.css';
import { Link } from 'react-router-dom';
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
  const { records, reload, error } = useWorkspaceRecords(inbox);
  return (
    <section className="container section">
      <h1>Notifications</h1>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="notifications"
          columns={['Notification', 'Received', 'Action']}
          rows={records.items.map((item) => ({
            id: item.id,
            search: item.message,
            cells: [
              <a href={item.url}>{item.message}</a>,
              new Date(item.received_at).toLocaleDateString('en-KE'),
              !item.read && (
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
              ),
            ],
          }))}
        />
      )}
    </section>
  );
}
