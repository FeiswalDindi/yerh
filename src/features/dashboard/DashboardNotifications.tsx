import { useId, useRef } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CloseButton } from '../../shared/CloseButton';
import { dashboardUpdateKeys } from './dashboard-notifications';
import type { DashboardNotificationState } from './useDashboardNotifications';

export function DashboardNotifications({
  notifications,
}: {
  notifications: DashboardNotificationState;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { groups, unread, markSeen, markAllSeen } = notifications;
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        className="icon-button dashboard-notifications-toggle"
        type="button"
        aria-label={
          unread
            ? `Notifications, ${unread} ${unread === 1 ? 'update' : 'updates'}`
            : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-controls={id}
        title="Notifications"
        onClick={() => dialog.current?.showModal()}
      >
        <Bell size={21} aria-hidden="true" />
        {unread > 0 && <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>
      <dialog
        className="dashboard-notifications-dialog"
        id={id}
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="dashboard-notifications-panel">
          <header>
            <h2 id={`${id}-title`}>Notifications</h2>
            <CloseButton className="icon-button" aria-label="Close notifications" onClick={close} />
          </header>
          {unread > 0 && (
            <button
              type="button"
              className="text-link dashboard-notifications-seen"
              onClick={markAllSeen}
            >
              Mark all as seen
            </button>
          )}
          {groups.length ? (
            <ul>
              {[...groups]
                .sort((first, second) => Number(second.unread > 0) - Number(first.unread > 0))
                .map((group) => (
                  <li key={group.to}>
                    <Link
                      to={group.to}
                      onClick={() => {
                        markSeen(dashboardUpdateKeys([group]));
                        close();
                      }}
                    >
                      <strong>{group.itemIds.length}</strong>
                      <span>
                        {group.label}
                        {group.unread > 0 && (
                          <small className="dashboard-notifications-new">{group.unread} new</small>
                        )}
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p>No dashboard updates yet.</p>
          )}
        </div>
      </dialog>
    </>
  );
}
