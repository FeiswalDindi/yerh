import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, UploadCloud, Video, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cmsRepository } from '../../../services/laravel-cms-repository';
import {
  engagementRepository,
  type EventCategory,
  type EventRecord,
  type Presenter,
} from '../../../services/laravel-engagement-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { EventPresenterAvatar } from '../../resources/EventPresenters';
import { EventCatalogue } from './EventCatalogue';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

type EditablePresenter = {
  key: string;
  name: string;
  profession: string;
  role: Presenter['role'];
  photo: string;
  localPreviewUrl?: string;
  uploading?: boolean;
  uploadError?: string;
};

function makePresenterRow(saved?: Presenter, index = 0): EditablePresenter {
  return {
    key: `presenter-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: saved?.name ?? '',
    profession: saved?.profession ?? '',
    role: saved?.role ?? 'host',
    photo: saved?.photo ?? '',
  };
}

function PresenterFields({ record }: { record?: EventRecord }) {
  const [rows, setRows] = useState<EditablePresenter[]>(() =>
    (record?.presenters ?? []).map((item, idx) => makePresenterRow(item, idx)),
  );
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function updateRow(key: string, patch: Partial<EditablePresenter>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleFileUpload(key: string, file: File | undefined) {
    if (!file) return;
    const row = rows.find((item) => item.key === key);
    const localUrl = URL.createObjectURL(file);
    objectUrlsRef.current.push(localUrl);
    updateRow(key, { localPreviewUrl: localUrl, uploading: true, uploadError: '' });

    try {
      const asset = await cmsRepository.uploadMedia(
        file,
        row?.name.trim() || 'Event Presenter',
        'events',
      );
      updateRow(key, {
        photo: asset.url,
        uploading: false,
        uploadError: '',
      });
    } catch (failure) {
      updateRow(key, {
        uploading: false,
        uploadError:
          failure instanceof Error ? failure.message : 'Could not upload presenter photo.',
      });
    }
  }

  const anyUploading = rows.some((row) => row.uploading);

  return (
    <fieldset>
      <legend>Hosts and facilitators</legend>
      {rows.map((row, index) => {
        const previewSrc = row.localPreviewUrl || row.photo;
        return (
          <div
            key={row.key}
            style={{
              border: '1px solid var(--yerh-border)',
              borderRadius: '0.55rem',
              padding: '0.85rem',
              marginBottom: '0.75rem',
              display: 'grid',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <EventPresenterAvatar
                  presenter={{
                    name: row.name || `Host ${index + 1}`,
                    photo: previewSrc,
                  }}
                />
                <div>
                  <strong>{row.name.trim() || `Host / Facilitator #${index + 1}`}</strong>
                  <div style={{ fontSize: '0.82rem', color: 'var(--yerh-muted)' }}>
                    {row.uploading
                      ? 'Optimising & uploading photo…'
                      : row.photo
                        ? 'Presenter photo ready'
                        : 'No photo uploaded yet (initials avatar shown)'}
                  </div>
                </div>
              </div>

              <div className="workspace-row-actions">
                <label
                  className="button button-outline button-small"
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {row.uploading ? <UploadCloud size={14} /> : <ImagePlus size={14} />}
                  {row.photo ? 'Change photo' : 'Pick photo from device'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      void handleFileUpload(row.key, file);
                    }}
                  />
                </label>
                {previewSrc && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() =>
                      updateRow(row.key, { photo: '', localPreviewUrl: undefined, uploadError: '' })
                    }
                  >
                    Clear photo
                  </button>
                )}
                <button
                  type="button"
                  className="button button-outline button-small"
                  aria-label={`Remove ${row.name || 'presenter'}`}
                  onClick={() =>
                    setRows((current) => current.filter((item) => item.key !== row.key))
                  }
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            {row.uploadError && (
              <p role="alert" className="form-error" style={{ margin: 0 }}>
                {row.uploadError}
              </p>
            )}

            <div className="workspace-form-grid">
              <label>
                Name
                <input
                  name="presenter_name"
                  value={row.name}
                  onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Profession / Title
                <input
                  name="presenter_profession"
                  value={row.profession}
                  onChange={(event) => updateRow(row.key, { profession: event.target.value })}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Role
                <select
                  name="presenter_role"
                  value={row.role}
                  onChange={(event) =>
                    updateRow(row.key, { role: event.target.value as Presenter['role'] })
                  }
                >
                  <option value="host">Host</option>
                  <option value="facilitator">Facilitator</option>
                </select>
              </label>
              <label>
                Photo URL (optional or auto-filled)
                <input
                  type="text"
                  name="presenter_photo"
                  value={row.photo}
                  onChange={(event) =>
                    updateRow(row.key, { photo: event.target.value, localPreviewUrl: undefined })
                  }
                  placeholder="/api/v1/cms/media/... or https://..."
                  maxLength={500}
                />
              </label>
            </div>
          </div>
        );
      })}

      {anyUploading && <input type="hidden" name="presenter_uploading" value="1" />}

      <div className="workspace-row-actions">
        {rows.length < 20 && (
          <button
            className="button button-outline workspace-action"
            type="button"
            onClick={() =>
              setRows((current) => [...current, makePresenterRow(undefined, current.length)])
            }
          >
            Add host / facilitator
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
  const [venueType, setVenueType] = useState<'physical' | 'virtual'>(
    record?.venue_type ?? 'physical',
  );

  return (
    <WorkspaceAction
      action={record ? 'Edit' : 'Add event'}
      create={!record}
      title={record?.title}
      save={async (form) => {
        if (fieldValue(form, 'presenter_uploading') === '1') {
          throw new Error('Wait for the presenter photo upload to finish before saving.');
        }
        const names = form.getAll('presenter_name');
        const professions = form.getAll('presenter_profession');
        const photos = form.getAll('presenter_photo');
        const roles = form.getAll('presenter_role');
        const chosenType = (fieldValue(form, 'venue_type') || 'physical') as 'physical' | 'virtual';
        await engagementRepository.saveEvent(
          {
            title: fieldValue(form, 'title'),
            summary: fieldValue(form, 'summary'),
            venue_type: chosenType,
            venue: fieldValue(form, 'venue'),
            meeting_link: chosenType === 'virtual' ? fieldValue(form, 'meeting_link') : null,
            category_id: fieldValue(form, 'category_id'),
            starts_at: fieldValue(form, 'starts_at'),
            ends_at: fieldValue(form, 'ends_at'),
            deadline: fieldValue(form, 'deadline'),
            capacity: fieldValue(form, 'capacity'),
            status: fieldValue(form, 'status'),
            presenters: names.map((name, index) => ({
              name,
              profession: professions[index],
              photo: String(photos[index] ?? '').trim() || undefined,
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
      <div className="workspace-form-grid">
        <label>
          Event format / venue type
          <select
            name="venue_type"
            value={venueType}
            onChange={(event) => setVenueType(event.target.value as 'physical' | 'virtual')}
          >
            <option value="physical">Physical venue</option>
            <option value="virtual">Virtual (online meeting)</option>
          </select>
        </label>
        {venueType === 'virtual' ? (
          <>
            <label>
              Meeting link (required for virtual)
              <input
                name="meeting_link"
                type="url"
                maxLength={500}
                defaultValue={record?.meeting_link ?? ''}
                placeholder="https://meet.google.com/... or https://zoom.us/..."
                required
              />
            </label>
            <label>
              Online platform / display label
              <input
                name="venue"
                maxLength={160}
                defaultValue={record?.venue_type === 'virtual' ? record.venue : ''}
                placeholder="Virtual (Google Meet)"
              />
            </label>
          </>
        ) : (
          <label>
            Physical venue / location
            <input
              name="venue"
              maxLength={160}
              defaultValue={record?.venue_type !== 'virtual' ? record?.venue : ''}
              placeholder="e.g. KCA University Innovation Hall, Nairobi"
              required
            />
          </label>
        )}
      </div>
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
          'Format & venue',
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
            search: [
              record.title,
              record.category,
              record.status,
              record.venue,
              record.venue_type,
            ].join(' '),
            cells: [
              record.title,
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {record.venue_type === 'virtual' ? (
                  <Video size={14} aria-hidden="true" />
                ) : (
                  <MapPin size={14} aria-hidden="true" />
                )}
                {record.venue}
              </span>,
              record.category,
              record.starts_at.replace('T', ' '),
              record.ends_at.replace('T', ' '),
              <StatusIndicator status={record.status} />,
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
