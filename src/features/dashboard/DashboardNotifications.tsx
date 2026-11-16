import { useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import type { DemoAccount } from '../../domain/demo';
import {
  loadReadNotifications,
  notificationReadKey,
  saveReadNotifications,
} from '../../services/notification-read-state';
import { CloseButton } from '../../shared/CloseButton';
import { dashboardUpdateKeys, dashboardUpdates } from './dashboard-notifications';

export function DashboardNotifications({ account }: { account: DemoAccount }) {
  const { state } = useDemo();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const storageKey = notificationReadKey(account.id);
  const [readKeys, setReadKeys] = useState(() => loadReadNotifications(storageKey));
  const updates = dashboardUpdates(state, account);
  const updateKeys = dashboardUpdateKeys(updates);
  const unread = updateKeys.filter((key) => !readKeys.has(key)).length;
  const close = () => dialog.current?.close();

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setReadKeys(loadReadNotifications(storageKey));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);

  function open() {
    if (!dialog.current) return;
    dialog.current.showModal();
    setReadKeys(new Set(updateKeys));
    saveReadNotifications(storageKey, updateKeys);
  }

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
        onClick={open}
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
          {updates.length ? (
            <ul>
              {updates.map(({ label, itemIds, to }) => (
                <li key={to}>
                  <Link to={to} onClick={close}>
                    <strong>{itemIds.length}</strong>
                    <span>{label}</span>
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
