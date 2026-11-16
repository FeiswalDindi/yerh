import { useId, useRef } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { CloseButton } from '../../shared/CloseButton';
import { dashboardUpdates } from './dashboard-notifications';

export function DashboardNotifications() {
  const { state, account } = useDemo();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const updates = account ? dashboardUpdates(state, account) : [];
  const count = updates.reduce((total, update) => total + update.count, 0);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        className="icon-button dashboard-notifications-toggle"
        type="button"
        aria-label={
          count ? `Notifications, ${count} ${count === 1 ? 'update' : 'updates'}` : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-controls={id}
        title="Notifications"
        onClick={() => dialog.current?.showModal()}
      >
        <Bell size={21} aria-hidden="true" />
        {count > 0 && <span aria-hidden="true">{count > 99 ? '99+' : count}</span>}
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
              {updates.map(({ label, count, to }) => (
                <li key={to}>
                  <Link to={to} onClick={close}>
                    <strong>{count}</strong>
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
