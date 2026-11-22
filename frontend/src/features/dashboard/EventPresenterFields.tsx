import { useRef, useState } from 'react';
import type { CommunitySession } from '../../domain/community';
import type { DemoAccount } from '../../domain/demo';
import {
  maxEventPresenters,
  maxPresenterPhotoLength,
  sessionPresenters,
  type EventPresenter,
} from '../../domain/events';
import { EventPresenterAvatar } from '../resources/EventPresenters';
import { field } from '../platform/incubation/TrainingForms';

const acceptedPhotos = ['image/jpeg', 'image/png', 'image/webp'];

async function eventPhoto(file: File) {
  if (!acceptedPhotos.includes(file.type) || file.size > 5 * 1024 * 1024)
    throw new Error('Choose a JPEG, PNG or WebP image up to 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    if (!crop) throw new Error('Choose a readable photo.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(crop, 224);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not prepare this photo.');
    context.drawImage(
      image,
      (image.naturalWidth - crop) / 2,
      (image.naturalHeight - crop) / 2,
      crop,
      crop,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const photo = canvas.toDataURL('image/webp', 0.75);
    if (photo.length > maxPresenterPhotoLength) throw new Error('Choose a smaller photo.');
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PresenterPhoto({
  presenter,
  update,
}: {
  presenter: EventPresenter;
  update: (photo?: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  async function change(element: HTMLInputElement) {
    const file = element.files?.[0];
    if (!file) {
      element.setCustomValidity('');
      setNotice('');
      return;
    }
    const busy = 'Preparing photo…';
    setNotice(busy);
    element.setCustomValidity(busy);
    try {
      const photo = await eventPhoto(file);
      if (!element.isConnected || element.files?.[0] !== file) return;
      update(photo);
      setNotice('');
    } catch (error) {
      if (!element.isConnected || element.files?.[0] !== file) return;
      setNotice(error instanceof Error ? error.message : 'Choose a readable photo.');
      element.value = '';
    }
    element.setCustomValidity('');
  }
  return (
    <div className="event-presenter-photo">
      <EventPresenterAvatar presenter={presenter} />
      <div>
        <label>
          Photo (optional)
          <input
            ref={input}
            type="file"
            accept={acceptedPhotos.join(',')}
            onChange={(event) => void change(event.currentTarget)}
          />
        </label>
        {notice && <p role="status">{notice}</p>}
        {presenter.photo && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              if (input.current) {
                input.current.value = '';
                input.current.setCustomValidity('');
              }
              update();
              setNotice('');
            }}
          >
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}

export function EventPresenterFields({
  session,
  accounts,
}: {
  session?: CommunitySession;
  accounts: DemoAccount[];
}) {
  const [presenters, setPresenters] = useState(() => sessionPresenters(session, accounts));
  function update(id: string, values: Partial<EventPresenter>) {
    setPresenters((current) => current.map((row) => (row.id === id ? { ...row, ...values } : row)));
  }
  return (
    <fieldset className="event-presenter-fields">
      <legend>Hosts &amp; facilitators</legend>
      {presenters.map((presenter, index) => {
        const key = 'presenter-' + presenter.id;
        return (
          <section key={presenter.id} aria-label={'Presenter ' + (index + 1)}>
            <input type="hidden" name="presenter-id" value={presenter.id} />
            <input type="hidden" name={key + '-photo'} value={presenter.photo ?? ''} />
            <div className="form-field-grid">
              <label>
                Presenter role
                <select
                  name={key + '-role'}
                  value={presenter.role}
                  onChange={(event) =>
                    update(presenter.id, { role: event.target.value as EventPresenter['role'] })
                  }
                >
                  <option value="host">Host</option>
                  <option value="facilitator">Facilitator</option>
                </select>
              </label>
              <label>
                Member profile (optional)
                <select
                  name={key + '-account'}
                  value={presenter.accountId ?? ''}
                  onChange={(event) => {
                    const member = accounts.find((account) => account.id === event.target.value);
                    update(
                      presenter.id,
                      member
                        ? {
                            accountId: member.id,
                            name: member.name,
                            profession: member.headline.trim().slice(0, 160) || 'YERH member',
                            photo: undefined,
                          }
                        : { accountId: undefined },
                    );
                  }}
                >
                  <option value="">Add a guest presenter</option>
                  {accounts
                    .filter(
                      (account) =>
                        account.id === presenter.accountId ||
                        (!account.suspended &&
                          !presenters.some((row) => row.accountId === account.id)),
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Full name
                <input
                  name={key + '-name'}
                  value={presenter.name}
                  minLength={2}
                  maxLength={120}
                  required
                  onChange={(event) => update(presenter.id, { name: event.target.value })}
                />
              </label>
              <label>
                Profession
                <input
                  name={key + '-profession'}
                  value={presenter.profession}
                  minLength={2}
                  maxLength={160}
                  required
                  onChange={(event) => update(presenter.id, { profession: event.target.value })}
                />
              </label>
            </div>
            <PresenterPhoto
              key={presenter.accountId ?? 'guest'}
              presenter={presenter}
              update={(photo) => update(presenter.id, { photo })}
            />
            <button
              className="text-link"
              type="button"
              onClick={() =>
                setPresenters((current) => current.filter((row) => row.id !== presenter.id))
              }
            >
              Remove presenter
            </button>
          </section>
        );
      })}
      <button
        className="button button-outline workspace-action"
        type="button"
        disabled={presenters.length >= maxEventPresenters}
        onClick={() =>
          setPresenters((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: current.length ? 'facilitator' : 'host',
              name: '',
              profession: '',
            },
          ])
        }
      >
        Add host or facilitator
      </button>
    </fieldset>
  );
}

export function readEventPresenters(data: FormData): EventPresenter[] {
  return data.getAll('presenter-id').map((id) => {
    const key = 'presenter-' + String(id);
    return {
      id: String(id),
      role: field(data, key + '-role') as EventPresenter['role'],
      name: field(data, key + '-name'),
      profession: field(data, key + '-profession'),
      photo: field(data, key + '-photo') || undefined,
      accountId: field(data, key + '-account') || undefined,
    };
  });
}
