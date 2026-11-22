import { Plus } from 'lucide-react';

export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export const label = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
export function Editor({
  value,
  onChange,
  path = '',
  readOnly = false,
  showStatus = false,
}: {
  value: Json;
  onChange: (v: Json) => void;
  path?: string;
  readOnly?: boolean;
  showStatus?: boolean;
}) {
  const key = path.split('.').at(-1) ?? '';
  if (
    (key === 'status' && !showStatus) ||
    (['publication', 'hostIds', 'presenters'].includes(key) && path.startsWith('sessions.'))
  )
    return null;
  const immutable =
    readOnly || ['source', 'sha256', 'id', 'ownerId', 'authorId', 'memberIds'].includes(key);
  if (Array.isArray(value)) {
    const entries = value;
    function addEntry() {
      if (path === 'team.members') {
        onChange([
          ...entries,
          {
            id: `cms-${crypto.randomUUID()}`,
            name: '',
            role: '',
            positioning: '',
            bio: '',
            image: '',
            linkedinUrl: '',
          },
        ]);
        return;
      }
      const first = structuredClone(entries.length ? entries[0]! : '');
      if (first && typeof first === 'object' && !Array.isArray(first) && 'id' in first)
        first.id = `cms-${crypto.randomUUID()}`;
      onChange([...entries, first]);
    }
    return (
      <fieldset className="cms-array">
        <legend>
          {label(key)} <small>{value.length} entries</small>
        </legend>
        {value.map((entry, index) => (
          <div className="cms-array-entry" key={index}>
            <Editor
              value={entry}
              path={`${path}.${index}`}
              showStatus={showStatus}
              readOnly={immutable}
              onChange={(v) => onChange(value.map((x, i) => (i === index ? v : x)))}
            />
            {!immutable && (
              <button
                type="button"
                className="text-link"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                Remove entry
              </button>
            )}
          </div>
        ))}
        {!immutable && (
          <button type="button" className="button button-outline cms-small" onClick={addEntry}>
            <Plus size={13} />
            Add entry
          </button>
        )}
      </fieldset>
    );
  }
  if (value && typeof value === 'object')
    return (
      <fieldset className="cms-object">
        <legend>{label(key) || 'Record'}</legend>
        {Object.entries(value).map(([k, v]) => (
          <Editor
            key={k}
            value={v}
            path={path ? `${path}.${k}` : k}
            showStatus={showStatus}
            readOnly={immutable}
            onChange={(next) => onChange({ ...value, [k]: next })}
          />
        ))}
      </fieldset>
    );
  const options =
    key === 'kind'
      ? ['article', 'story', 'business', 'event', 'publication', 'resource']
      : path.startsWith('sessions.') && key === 'type'
        ? ['workshop', 'webinar', 'bootcamp', 'masterclass', 'summit', 'exhibition']
        : path.startsWith('sessions.') && key === 'status'
          ? ['upcoming', 'completed', 'postponed']
          : path.startsWith('opportunities.') && key === 'status'
            ? ['draft', 'review', 'published', 'closed', 'archived']
            : path.startsWith('opportunities.') && key === 'type'
              ? ['internal', 'external']
              : key === 'mode'
                ? ['online', 'in_person', 'hybrid']
                : key === 'status' && path.startsWith('items.')
                  ? ['published', 'archived']
                  : null;
  if (options)
    return (
      <label className="cms-field">
        <span>{label(key)}</span>
        <select
          disabled={immutable}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  if (typeof value === 'boolean')
    return (
      <label className="cms-checkbox">
        <input
          type="checkbox"
          checked={value}
          disabled={immutable}
          onChange={(e) => onChange(e.target.checked)}
        />
        {path.startsWith('opportunities.') && key === 'featured'
          ? 'Feature this opportunity'
          : label(key)}
      </label>
    );
  return (
    <label className="cms-field">
      <span>
        {label(key)}
        {value === null && <small>Optional · leave blank to keep empty</small>}
      </span>
      {typeof value === 'number' || key === 'capacity' ? (
        <input
          type="number"
          value={value === null ? '' : String(value)}
          disabled={immutable}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      ) : key === 'type' && path.includes('blocks') ? (
        <select
          value={String(value ?? '')}
          disabled={immutable}
          onChange={(e) => onChange(e.target.value)}
        >
          {['paragraph', 'heading', 'list-item'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      ) : String(value ?? '').length > 140 ||
        /body|description|text|excerpt|summary|answer|eligibility|benefits|note/i.test(key) ? (
        <textarea
          value={String(value ?? '')}
          disabled={immutable}
          rows={4}
          onChange={(e) => onChange(value === null && !e.target.value ? null : e.target.value)}
        />
      ) : (
        <input
          value={String(value ?? '')}
          disabled={immutable}
          list={/Ids?($|\.)/.test(path) ? 'cms-ids' : undefined}
          onChange={(e) => onChange(value === null && !e.target.value ? null : e.target.value)}
        />
      )}
    </label>
  );
}
