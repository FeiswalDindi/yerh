import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import type { CommunitySession } from '../../domain/community';
import {
  eventCategories,
  eventTypes,
  isPublishedSession,
  sessionCategory,
  type EventCategory,
} from '../../domain/events';
import { isPastSession } from '../benefits/event-filters';
import {
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from '../platform/WorkspaceControls';
import { field } from '../platform/TrainingForms';
import { dashboardCataloguePaths } from './catalogue-paths';
import { EventPresenterFields, readEventPresenters } from './EventPresenterFields';

const eventTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function localTime(value?: string | null) {
  if (!value) return '';
  const parts = Object.fromEntries(
    eventTime.formatToParts(new Date(value)).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function EventEditor({
  categories,
  session,
  archive = false,
}: {
  categories: EventCategory[];
  session?: CommunitySession;
  archive?: boolean;
}) {
  const { state, execute } = useDemo();
  return (
    <WorkspaceFormDialog
      action={session ? 'Edit' : 'Add event'}
      title={session?.title}
      create={!session}
      submit="Save event"
      onSave={(data) => {
        const category = categories.find((row) => row.id === field(data, 'category'))!;
        const date = (key: string, current?: string | null) => {
          const value = field(data, key);
          return !value ? null : value === localTime(current) ? current! : value + ':00+03:00';
        };
        const capacity = field(data, 'capacity');
        const presenters = readEventPresenters(data);
        return execute({
          type: 'event-save',
          now: new Date().toISOString(),
          previous: field(data, 'event-version'),
          session: {
            id: session?.id ?? crypto.randomUUID(),
            title: field(data, 'title'),
            summary: field(data, 'summary'),
            venue: field(data, 'venue'),
            type: category.type,
            categoryId: category.id,
            publication: field(data, 'publication') as CommunitySession['publication'],
            status: field(data, 'status') as CommunitySession['status'],
            startsAt: date('start', session?.startsAt),
            endsAt: date('end', session?.endsAt),
            registrationDeadline: date('deadline', session?.registrationDeadline),
            capacity: capacity ? Number(capacity) : null,
            timezone: session?.timezone ?? 'Africa/Nairobi',
            hostIds: presenters.flatMap((row) => (row.accountId ? [row.accountId] : [])),
            presenters,
            groupId: session?.groupId ?? null,
            forumId: session?.forumId ?? null,
            contentId: session?.contentId ?? null,
            fictional: session?.fictional ?? true,
          },
        });
      }}
    >
      <input type="hidden" name="event-version" defaultValue={JSON.stringify(session ?? null)} />
      <label>
        Event name
        <input name="title" required minLength={3} maxLength={120} defaultValue={session?.title} />
      </label>
      <label>
        Description
        <textarea name="summary" maxLength={3000} defaultValue={session?.summary} />
      </label>
      <div className="form-field-grid">
        <label>
          Category
          <select name="category" required defaultValue={session?.categoryId ?? session?.type}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Schedule
          <select
            name="status"
            defaultValue={session?.status ?? (archive ? 'completed' : 'upcoming')}
          >
            <option value="upcoming">Scheduled</option>
            <option value="postponed">Postponed</option>
            <option value="completed">Completed · show in archive</option>
          </select>
        </label>
        <label>
          Publication
          <select
            name="publication"
            defaultValue={session ? (session.publication ?? 'published') : 'draft'}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          Venue or meeting location
          <input name="venue" maxLength={160} defaultValue={session?.venue} />
        </label>
        <label>
          Capacity
          <input
            name="capacity"
            type="number"
            min={1}
            step={1}
            defaultValue={session?.capacity ?? ''}
          />
        </label>
        <label>
          Starts (EAT)
          <input name="start" type="datetime-local" defaultValue={localTime(session?.startsAt)} />
        </label>
        <label>
          Ends (EAT)
          <input name="end" type="datetime-local" defaultValue={localTime(session?.endsAt)} />
        </label>
        <label>
          Registration deadline (EAT)
          <input
            name="deadline"
            type="datetime-local"
            defaultValue={localTime(session?.registrationDeadline)}
          />
        </label>
      </div>
      <EventPresenterFields session={session} accounts={state.accounts} />
      {archive && session && <p>Save new future dates to return this event to Upcoming.</p>}
    </WorkspaceFormDialog>
  );
}

function CategoryEditor({ category }: { category?: EventCategory }) {
  const { execute } = useDemo();
  return (
    <WorkspaceFormDialog
      action={category ? 'Edit category' : 'Add category'}
      title={category?.label}
      create={!category}
      submit="Save category"
      onSave={(data) =>
        execute({
          type: 'event-category-save',
          now: new Date().toISOString(),
          category: {
            id: category?.id ?? crypto.randomUUID(),
            label: field(data, 'label'),
            type: category?.type ?? (field(data, 'type') as CommunitySession['type']),
          },
        })
      }
    >
      <label>
        Category name
        <input name="label" required minLength={2} maxLength={60} defaultValue={category?.label} />
      </label>
      {!category && (
        <label>
          Event type
          <select name="type">
            {Object.entries(eventTypes).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
    </WorkspaceFormDialog>
  );
}

export function AdminEvents({ preview }: { preview: ReactNode }) {
  const { state, execute } = useDemo();
  const categories = eventCategories(state.platform.eventCategories);
  const now = Date.now();
  const past = state.sessions.filter((session) => isPastSession(session, now));
  const upcoming = state.sessions.filter((session) => !isPastSession(session, now));
  function directory(sessions: CommunitySession[], archive = false) {
    return (
      <WorkspaceTable
        label={archive ? 'archived events' : 'upcoming events'}
        columns={['Event', 'Category', 'Starts (EAT)', 'Reservations', 'Publication', 'Actions']}
        actions={<EventEditor categories={categories} archive={archive} />}
        rows={[...sessions]
          .sort((first, second) => {
            const left = first.startsAt ? Date.parse(first.startsAt) : archive ? 0 : Infinity;
            const right = second.startsAt ? Date.parse(second.startsAt) : archive ? 0 : Infinity;
            return (
              (archive ? right - left : left - right) || first.title.localeCompare(second.title)
            );
          })
          .map((session) => {
            const category = sessionCategory(session, categories);
            const published = isPublishedSession(session);
            const publication = published ? 'published' : 'draft';
            const seats = state.registrations.filter(
              (row) => row.sessionId === session.id && row.status !== 'cancelled',
            ).length;
            return {
              id: session.id,
              search: [session.title, category.label, session.venue, publication].join(' '),
              cells: [
                session.title,
                category.label,
                session.startsAt ? eventTime.format(new Date(session.startsAt)) : '—',
                session.capacity === null ? String(seats) : `${seats} / ${session.capacity}`,
                <WorkspaceStatus>{published ? 'Published' : 'Draft'}</WorkspaceStatus>,
                <div className="workspace-row-actions">
                  <EventEditor categories={categories} session={session} archive={archive} />
                  <WorkspaceFormDialog
                    action={published ? 'Move to draft' : 'Publish'}
                    title={session.title}
                    submit={published ? 'Move to draft' : 'Publish event'}
                    onSave={() =>
                      execute({
                        type: 'event-save',
                        now: new Date().toISOString(),
                        previous: JSON.stringify(session),
                        session: { ...session, publication: published ? 'draft' : 'published' },
                      })
                    }
                  >
                    <p>
                      {published
                        ? 'Hide this event from event listings. Existing reservations stay on the record.'
                        : 'Make this event visible in public event listings and the entrepreneur catalogue.'}
                    </p>
                  </WorkspaceFormDialog>
                  <Link
                    to={
                      dashboardCataloguePaths.events +
                      '/' +
                      encodeURIComponent(session.id) +
                      '?eventView=' +
                      (archive ? 'archive' : 'upcoming')
                    }
                  >
                    View event
                  </Link>
                </div>,
              ],
            };
          })}
      />
    );
  }
  return (
    <section className="container section workspace-content" aria-label="Event administration">
      <h1 className="sr-only">Events</h1>
      <WorkspaceTabs
        label="Event management views"
        param="eventView"
        views={[
          {
            id: 'upcoming',
            label: 'Upcoming',
            count: upcoming.length,
            content: directory(upcoming),
          },
          { id: 'archive', label: 'Archive', count: past.length, content: directory(past, true) },
          {
            id: 'categories',
            label: 'Categories',
            content: (
              <WorkspaceTable
                label="event categories"
                columns={['Category', 'Event type', 'Events', 'Action']}
                actions={<CategoryEditor />}
                rows={categories.map((category) => ({
                  id: category.id,
                  search: category.label,
                  cells: [
                    category.label,
                    eventTypes[category.type],
                    state.sessions.filter(
                      (session) => (session.categoryId ?? session.type) === category.id,
                    ).length,
                    <CategoryEditor category={category} />,
                  ],
                }))}
              />
            ),
          },
          { id: 'preview', label: 'Preview', content: preview },
        ]}
      />
    </section>
  );
}
