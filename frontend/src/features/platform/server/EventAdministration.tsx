import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  engagementRepository,
  type EventCategory,
  type EventRecord,
} from '../../../services/laravel-engagement-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { EventCatalogue } from './EventCatalogue';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

function PresenterFields({ record }: { record?: EventRecord }) {
  const [count, setCount] = useState(record?.presenters.length ?? 0);
  return (
    <fieldset>
      <legend>Hosts and facilitators</legend>
      {Array.from({ length: count }, (_, index) => {
        const saved = record?.presenters[index];
        return (
          <div key={index} className="workspace-form-grid">
            <label>
              Name
              <input name="presenter_name" defaultValue={saved?.name} maxLength={100} required />
            </label>
            <label>
              Profession
              <input
                name="presenter_profession"
                defaultValue={saved?.profession}
                maxLength={100}
                required
              />
            </label>
            <label>
              Role
              <select name="presenter_role" defaultValue={saved?.role ?? 'host'}>
                <option value="host">Host</option>
                <option value="facilitator">Facilitator</option>
              </select>
            </label>
            <label>
              Photo URL
              <input
                type="url"
                name="presenter_photo"
                defaultValue={saved?.photo}
                maxLength={500}
              />
            </label>
          </div>
        );
      })}
      <div className="workspace-row-actions">
        {count < 20 && (
          <button
            className="button button-outline workspace-action"
            type="button"
            onClick={() => setCount(count + 1)}
          >
            Add presenter
          </button>
        )}
        {count > 0 && (
          <button
            className="button button-outline workspace-action"
            type="button"
            onClick={() => setCount(count - 1)}
          >
            Remove last
          </button>
        )}
      </div>
    </fieldset>
  );
}

function EventEditor({
  categories,
  reload,
  record,
}: {
  categories: EventCategory[];
  reload: () => void;
  record?: EventRecord;
}) {
  return (
    <WorkspaceAction
      action={record ? 'Edit' : 'Add event'}
      create={!record}
      title={record?.title}
      save={async (form) => {
        const names = form.getAll('presenter_name');
        const professions = form.getAll('presenter_profession');
        const photos = form.getAll('presenter_photo');
        const roles = form.getAll('presenter_role');
        await engagementRepository.saveEvent(
          {
            title: fieldValue(form, 'title'),
            summary: fieldValue(form, 'summary'),
            venue: fieldValue(form, 'venue'),
            category_id: fieldValue(form, 'category_id'),
            starts_at: fieldValue(form, 'starts_at'),
            ends_at: fieldValue(form, 'ends_at'),
            deadline: fieldValue(form, 'deadline'),
            capacity: fieldValue(form, 'capacity'),
            status: fieldValue(form, 'status'),
            presenters: names.map((name, index) => ({
              name,
              profession: professions[index],
              photo: photos[index],
              role: roles[index],
            })),
          },
          record?.id,
        );
        reload();
      }}
    >
      <label>
        Title
        <input name="title" maxLength={140} defaultValue={record?.title} required />
      </label>
      <label>
        Description
        <textarea name="summary" maxLength={5000} defaultValue={record?.summary} required />
      </label>
      <label>
        Venue
        <input name="venue" maxLength={160} defaultValue={record?.venue} required />
      </label>
      <div className="workspace-form-grid">
        <label>
          Category
          <select name="category_id" defaultValue={record?.category_id} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Publication
          <select name="status" defaultValue={record?.status ?? 'draft'}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          Starts (EAT)
          <input name="starts_at" type="datetime-local" defaultValue={record?.starts_at} required />
        </label>
        <label>
          Ends (EAT)
          <input name="ends_at" type="datetime-local" defaultValue={record?.ends_at} required />
        </label>
        <label>
          Registration deadline (EAT)
          <input
            name="deadline"
            type="datetime-local"
            defaultValue={record?.deadline ?? undefined}
          />
        </label>
        <label>
          Capacity
          <input
            name="capacity"
            type="number"
            min="1"
            max="200000"
            defaultValue={record?.capacity ?? undefined}
          />
        </label>
      </div>
      <PresenterFields record={record} />
    </WorkspaceAction>
  );
}

function CategoryEditor({ category, reload }: { category?: EventCategory; reload: () => void }) {
  return (
    <WorkspaceAction
      action={category ? 'Edit' : 'Add category'}
      create={!category}
      title={category?.name}
      save={async (form) => {
        await engagementRepository.saveCategory(fieldValue(form, 'name'), category?.id);
        reload();
      }}
    >
      <label>
        Name
        <input name="name" defaultValue={category?.name} maxLength={80} required />
      </label>
    </WorkspaceAction>
  );
}

export function EventAdministration() {
  const { records, error, reload } = useWorkspaceRecords(engagementRepository.manageEvents);
  const events = (archived: boolean) =>
    records && (
      <WorkspaceTable
        label={archived ? 'archived events' : 'upcoming events'}
        columns={[
          'Event',
          'Category',
          'Starts (EAT)',
          'Ends (EAT)',
          'Publication',
          'Bookings',
          'Actions',
        ]}
        actions={
          !archived &&
          (records.categories.length ? (
            <EventEditor categories={records.categories} reload={reload} />
          ) : (
            <span>Add a category to create an event.</span>
          ))
        }
        rows={records.events
          .filter((record) => record.archived === archived)
          .map((record) => ({
            id: String(record.id),
            search: [record.title, record.category, record.status, record.venue].join(' '),
            cells: [
              record.title,
              record.category,
              record.starts_at.replace('T', ' '),
              record.ends_at.replace('T', ' '),
              record.status === 'published' ? 'Published' : 'Draft',
              record.bookings,
              <div className="workspace-row-actions">
                <EventEditor record={record} categories={records.categories} reload={reload} />
                {record.status === 'published' && <Link to={'/sessions/' + record.slug}>View</Link>}
              </div>,
            ],
          }))}
      />
    );
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTabs
          label="Event management"
          views={[
            { id: 'upcoming', label: 'Upcoming', content: events(false) },
            { id: 'archive', label: 'Archived', content: events(true) },
            {
              id: 'categories',
              label: 'Categories',
              content: (
                <WorkspaceTable
                  label="event categories"
                  columns={['Category', 'Events', 'Action']}
                  actions={<CategoryEditor reload={reload} />}
                  rows={records.categories.map((category) => ({
                    id: String(category.id),
                    search: category.name,
                    cells: [
                      category.name,
                      records.events.filter((record) => record.category_id === category.id).length,
                      <CategoryEditor category={category} reload={reload} />,
                    ],
                  }))}
                />
              ),
            },
            { id: 'preview', label: 'Preview', content: <EventCatalogue embedded /> },
          ]}
        />
      )}
    </>
  );
}
