import { Link } from 'react-router-dom';
import { memberPath } from '../../domain/community';
import type { EventPresenter } from '../../domain/events';
import './event-presenters.css';

export function EventPresenterAvatar({
  presenter,
}: {
  presenter: Pick<EventPresenter, 'name' | 'photo'>;
}) {
  const initials = presenter.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <span className="event-presenter-avatar" aria-hidden="true">
      {presenter.photo ? <img src={presenter.photo} alt="" loading="lazy" /> : initials || '•'}
    </span>
  );
}

export function EventPresenters({ presenters }: { presenters: EventPresenter[] }) {
  return (
    <ul className="event-presenter-list">
      {presenters.map((presenter) => (
        <li key={presenter.id}>
          <EventPresenterAvatar presenter={presenter} />
          <div>
            <strong>
              {presenter.accountId ? (
                <Link to={memberPath(presenter.accountId)}>{presenter.name}</Link>
              ) : (
                presenter.name
              )}
            </strong>
            <span>{presenter.profession}</span>
            <small>{presenter.role === 'host' ? 'Host' : 'Facilitator'}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
