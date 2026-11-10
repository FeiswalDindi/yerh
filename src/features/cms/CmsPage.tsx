import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Save, Globe, Eye, Plus, RotateCcw, Search, FileText, LayoutDashboard } from 'lucide-react';
import { useCatalog, ContentContext } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { can } from '../../domain/roles';
import { assertCmsSnapshot } from '../../domain/cms';
import type { CmsSnapshot } from '../../domain/platform';
import { ContentCard } from '../content/ContentCard';
import { FeatureCarousel } from '../home/FeatureCarousel';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
import { createCmsSnapshot } from '../../services/cms-snapshot';
import { CmsPreview } from './CmsPreview';

type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
const label = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
function Editor({
  value,
  onChange,
  path = '',
  readOnly = false,
}: {
  value: Json;
  onChange: (v: Json) => void;
  path?: string;
  readOnly?: boolean;
}) {
  const key = path.split('.').at(-1) ?? '';
  const immutable =
    readOnly || ['source', 'sha256', 'id', 'ownerId', 'authorId', 'memberIds'].includes(key);
  if (Array.isArray(value))
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
          <button
            type="button"
            className="button button-outline cms-small"
            onClick={() =>
              onChange([
                ...value,
                value.length
                  ? typeof value[0] === 'object' &&
                    value[0] !== null &&
                    !Array.isArray(value[0]) &&
                    'id' in value[0]
                    ? { ...structuredClone(value[0]), id: `cms-${crypto.randomUUID()}` }
                    : structuredClone(value[0]!)
                  : '',
              ])
            }
          >
            <Plus size={13} />
            Add entry
          </button>
        )}
      </fieldset>
    );
  if (value && typeof value === 'object')
    return (
      <fieldset className="cms-object">
        <legend>{label(key) || 'Record'}</legend>
        {Object.entries(value).map(([k, v]) => (
          <Editor
            key={k}
            value={v}
            path={path ? `${path}.${k}` : k}
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
        {label(key)}
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
const modules = [
  ['overview', 'Overview'],
  ['items', 'Articles, stories & listings'],
  ['homepage', 'Homepage & featured content'],
  ['site', 'Pages, navigation & settings'],
  ['courses', 'Courses'],
  ['lessons', 'Lessons & media'],
  ['topics', 'Resource pathways'],
  ['faqs', 'FAQs'],
  ['sidebar', 'Sidebar widgets'],
  ['media', 'Media library & partners'],
  ['terms', 'Terms & conditions'],
  ['sessions', 'Events & workshops'],
  ['opportunities', 'Opportunities'],
  ['community', 'Community groups & forums'],
  ['revisions', 'Revisions & audit'],
] as const;
export function CmsPage() {
  const catalog = useCatalog();
  const { state, account, execute } = useDemo();
  usePageTitle('Content management');
  const [module, setModule] = useState<string>('overview');
  const [snapshot, setSnapshot] = useState<CmsSnapshot>(() => createCmsSnapshot(catalog, state));
  const [baseRevision, setBaseRevision] = useState(state.platform.cmsRevision);
  const [id, setId] = useState<string>(() => crypto.randomUUID());
  const [title, setTitle] = useState('Website content update');
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pagePath, setPagePath] = useState('/pages/');
  if (!account || !can(account, 'cms'))
    return (
      <section className="container section">
        <h1>Content access required</h1>
        <Link to="/dashboard">Return to your dashboard</Link>
      </section>
    );
  const p = state.platform;
  const root =
    module === 'sessions'
      ? snapshot.sessions
      : module === 'opportunities'
        ? snapshot.opportunities
        : module === 'community'
          ? snapshot.community
          : (snapshot.catalog as unknown as Record<string, Json>)[module];
  const array = Array.isArray(root);
  const records = array ? (root as unknown as Record<string, Json>[]) : [];
  const value = array ? records[selected] : root;
  const workflowOwned =
    module === 'items' &&
    !!value &&
    typeof value === 'object' &&
    String(((value as Record<string, Json>).source as Record<string, Json>)?.path ?? '').startsWith(
      'local-demo',
    );
  function change(next: unknown) {
    setDirty(true);
    setPreview(false);
    if (module === 'sessions' || module === 'opportunities' || module === 'community')
      setSnapshot({ ...snapshot, [module]: next });
    else setSnapshot({ ...snapshot, catalog: { ...snapshot.catalog, [module]: next } });
  }
  function edit(next: Json) {
    if (array) change(records.map((r, i) => (i === selected ? next : r)));
    else change(next);
  }
  function validate() {
    try {
      assertCmsSnapshot(snapshot, state);
      setMessage('Validation passed. References, URLs and required fields are consistent.');
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Invalid content.');
      return false;
    }
  }
  function save() {
    if (!validate()) return;
    if (
      execute({
        type: 'cms-save',
        baseline: createCmsSnapshot(catalog, state),
        draft: {
          id,
          ownerId: account!.id,
          title,
          baseRevision,
          snapshot,
          updatedAt: new Date().toISOString(),
        },
        now: new Date().toISOString(),
      })
    ) {
      setDirty(false);
      setMessage('Draft saved. Public pages are unchanged until publication.');
    }
  }
  function publish() {
    if (dirty) {
      setMessage('Save your latest changes before publishing.');
      return;
    }
    if (execute({ type: 'cms-publish', id, now: new Date().toISOString() })) {
      setBaseRevision(p.cmsRevision + 1);
      setId(crypto.randomUUID());
      setMessage('Published successfully. Open the site to review the new revision.');
    }
  }
  function startLatest() {
    if (dirty && !window.confirm('Discard unsaved editor changes and reload the published site?'))
      return;
    setSnapshot(createCmsSnapshot(catalog, state));
    setBaseRevision(p.cmsRevision);
    setId(crypto.randomUUID());
    setSelected(0);
    setDirty(false);
    setMessage('Loaded the current published site.');
  }
  function duplicate() {
    if (!array || !value || typeof value !== 'object') return;
    const copy = structuredClone(value) as Record<string, Json>;
    const newId = `cms-${crypto.randomUUID()}`;
    copy.id = newId;
    if ('slug' in copy) copy.slug = newId;
    if ('title' in copy)
      copy.title = `New ${module === 'items' ? String(copy.kind) : module === 'sessions' ? 'session' : 'record'}`;
    if ('source' in copy) {
      copy.source = { path: 'local-cms', url: '', sha256: '' };
      if ('authorId' in copy) copy.authorId = account!.id;
    }
    if ('status' in copy)
      copy.status =
        module === 'opportunities' ? 'draft' : module === 'sessions' ? 'postponed' : 'published';
    if ('memberIds' in copy) copy.memberIds = [];
    change([...records, copy]);
    setSelected(records.length);
  }
  let editor: ReactNode = null;
  if (value !== undefined)
    editor = (
      <>
        {workflowOwned && (
          <p className="cms-help">
            This record is managed through its contribution or venture workflow. Its ID can be used
            in featured-content fields.{' '}
            <Link to="/dashboard/content">Open contribution review →</Link>
          </p>
        )}
        <Editor value={value as Json} path={module} readOnly={workflowOwned} onChange={edit} />
      </>
    );
  return (
    <section className="cms-page">
      <header className="cms-topbar">
        <div>
          <span className="eyebrow">YERH CONTENT STUDIO</span>
          <h1>Content management</h1>
          <p>
            Published revision {p.cmsRevision} · Editing from revision {baseRevision}
          </p>
        </div>
        <div className="cms-actions">
          <Link className="button button-outline" to="/" target="_blank">
            View site <Globe size={15} />
          </Link>
          <button
            className="button button-outline"
            onClick={() => {
              if (validate()) setPreview(!preview);
            }}
          >
            <Eye size={15} />
            Preview
          </button>
          <button className="button button-outline" onClick={save}>
            <Save size={15} />
            Save draft
          </button>
          <button
            className="button"
            disabled={dirty || !p.cmsDrafts.some((d) => d.id === id)}
            onClick={publish}
          >
            Publish
          </button>
        </div>
      </header>
      <div className="cms-layout">
        <nav className="cms-nav" aria-label="Content modules">
          <Link to="/dashboard">
            <LayoutDashboard size={16} />
            Workspace
          </Link>
          <Link to="/dashboard/content">Contribution review</Link>
          <Link to="/dashboard/moderation">Discussion moderation</Link>
          {modules.map(([key, name]) => (
            <button
              key={key}
              className={module === key ? 'active' : ''}
              onClick={() => {
                setModule(key);
                setSelected(0);
                setQuery('');
                setPreview(false);
              }}
            >
              {name}
            </button>
          ))}
        </nav>
        <div className="cms-main">
          <DemoNotice />
          {message && (
            <p className="cms-message" role="status">
              {message}
            </p>
          )}
          <div className="cms-draft-title">
            <label>
              Change-set title
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                maxLength={140}
              />
            </label>
            <button className="text-link" onClick={startLatest}>
              Reload latest published site
            </button>
          </div>
          {module === 'overview' ? (
            <>
              <div className="cms-stat-grid">
                {[
                  [snapshot.catalog.items.length, 'Content records'],
                  [snapshot.catalog.courses.length, 'Courses'],
                  [snapshot.sessions.length, 'Events'],
                  [snapshot.opportunities.length, 'Opportunities'],
                ].map(([count, name]) => (
                  <div className="profile-panel" key={name}>
                    <strong>{count}</strong>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
              <div className="cms-help">
                <h2>A controlled publishing workflow</h2>
                <ol>
                  <li>Edit a module and validate references.</li>
                  <li>Save a named draft.</li>
                  <li>Preview and publish when ready.</li>
                  <li>Restore a retained revision if needed.</li>
                </ol>
                <p>
                  Public routes read the latest published revision. Drafts remain in this
                  development browser.
                </p>
              </div>
              <h2>Saved drafts</h2>
              {p.cmsDrafts
                .filter((d) => d.ownerId === account.id || can(account, 'admin'))
                .map((d) => (
                  <button
                    className="cms-draft-row"
                    key={d.id}
                    onClick={() => {
                      if (dirty && !window.confirm('Discard unsaved changes and load this draft?'))
                        return;
                      setSnapshot(structuredClone(d.snapshot));
                      setId(d.id);
                      setBaseRevision(d.baseRevision);
                      setTitle(d.title);
                      setDirty(false);
                      setMessage('Draft loaded.');
                    }}
                  >
                    <FileText size={18} />
                    <strong>{d.title}</strong>
                    <span>Based on revision {d.baseRevision}</span>
                  </button>
                ))}
            </>
          ) : module === 'revisions' ? (
            <>
              <h2>Revision history</h2>
              <p>
                The five latest published snapshots are retained. Restoring creates a new revision.
              </p>
              {p.cmsReleases
                .slice()
                .reverse()
                .map((r) => (
                  <article className="workspace-record" key={r.id}>
                    <h3>
                      Revision {r.revision} · {r.title}
                    </h3>
                    <p>{new Date(r.createdAt).toLocaleString('en-KE')}</p>
                    <button
                      className="button button-outline"
                      onClick={() => {
                        if (
                          execute({
                            type: 'cms-rollback',
                            revision: r.revision,
                            now: new Date().toISOString(),
                          })
                        )
                          setMessage(
                            'Revision restored. Reload latest published site before making further edits.',
                          );
                      }}
                    >
                      <RotateCcw size={15} />
                      Restore as new revision
                    </button>
                  </article>
                ))}
              <h2>Editorial audit</h2>
              {p.audit
                .filter((a) => a.action.startsWith('cms-'))
                .slice(0, 30)
                .map((a) => (
                  <p className="cms-audit-row" key={a.id}>
                    {a.action} · {state.accounts.find((u) => u.id === a.actorId)?.name} ·{' '}
                    {new Date(a.createdAt).toLocaleString('en-KE')}
                  </p>
                ))}
            </>
          ) : (
            <>
              <h2>{modules.find(([key]) => key === module)?.[1]}</h2>
              {module === 'site' && (
                <div className="cms-help">
                  <p>
                    Page headers, additional sections, menus, contact details, social links and
                    homepage section visibility are managed here.
                  </p>
                  <form
                    className="cms-page-create"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const path = pagePath.trim();
                      if (
                        !/^\/[a-z0-9/-]+$/.test(path) ||
                        /^\/(dashboard|profile|login|register|apply)/.test(path)
                      ) {
                        setMessage('Use a public route such as /about or /pages/our-programme.');
                        return;
                      }
                      if (snapshot.catalog.site.pages[path]) {
                        setMessage('This page already exists. Edit its fields below.');
                        return;
                      }
                      change({
                        ...snapshot.catalog.site,
                        pages: {
                          ...snapshot.catalog.site.pages,
                          [path]: {
                            title: 'New page',
                            eyebrow: 'YERH',
                            description: 'Describe this page.',
                            sections: [
                              { title: 'Section heading', body: 'Add your page content here.' },
                            ],
                          },
                        },
                      });
                      setMessage(
                        'Page fields added below. Add a navigation link if this is a new /pages/ route.',
                      );
                    }}
                  >
                    <label>
                      Public page path
                      <input
                        required
                        value={pagePath}
                        onChange={(e) => setPagePath(e.target.value)}
                        placeholder="/pages/our-programme"
                      />
                    </label>
                    <button className="button button-outline">Add page or page override</button>
                  </form>
                </div>
              )}
              {array ? (
                <div className="cms-record-layout">
                  <aside className="cms-record-list">
                    <label className="cms-search">
                      <Search size={15} />
                      <input
                        placeholder="Find a record…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    {records
                      .map((record, index) => ({ record, index }))
                      .filter(({ record }) =>
                        JSON.stringify(record).toLowerCase().includes(query.toLowerCase()),
                      )
                      .map(({ record, index }) => (
                        <button
                          key={String(record.id ?? index)}
                          className={selected === index ? 'active' : ''}
                          onClick={() => {
                            setSelected(index);
                            setPreview(false);
                          }}
                        >
                          <strong>
                            {String(
                              record.title ??
                                record.question ??
                                record.name ??
                                record.id ??
                                `Record ${index + 1}`,
                            )}
                          </strong>
                          <small>
                            {String(record.kind ?? record.category ?? record.status ?? '')}
                          </small>
                        </button>
                      ))}
                    <button className="button button-outline" onClick={duplicate}>
                      <Plus size={14} />
                      Duplicate selected record
                    </button>
                  </aside>
                  <div className="cms-editor">
                    {module === 'items' && value && !workflowOwned && (
                      <div className="cms-record-actions">
                        <button
                          className="text-link"
                          onClick={() =>
                            edit({
                              ...(value as Record<string, Json>),
                              status:
                                (value as Record<string, Json>).status === 'archived'
                                  ? 'published'
                                  : 'archived',
                            })
                          }
                        >
                          {(value as Record<string, Json>).status === 'archived'
                            ? 'Restore record'
                            : 'Archive record'}
                        </button>
                      </div>
                    )}
                    {editor}
                  </div>
                </div>
              ) : (
                <div className="cms-editor">{editor}</div>
              )}
              {module === 'opportunities' && (
                <div className="cms-help">
                  <h3>Submitted opportunities awaiting review</h3>
                  {p.opportunities
                    .filter((o) => o.status === 'review')
                    .map((o) => (
                      <div className="workspace-record" key={o.id}>
                        <strong>{o.title}</strong>
                        <p>{o.summary}</p>
                        <button
                          className="button"
                          onClick={() =>
                            execute({
                              type: 'opportunity-status',
                              id: o.id,
                              status: 'published',
                              now: new Date().toISOString(),
                            })
                          }
                        >
                          Publish opportunity
                        </button>
                        <button
                          className="text-link"
                          onClick={() =>
                            execute({
                              type: 'opportunity-status',
                              id: o.id,
                              status: 'draft',
                              now: new Date().toISOString(),
                            })
                          }
                        >
                          Return to draft
                        </button>
                      </div>
                    ))}
                </div>
              )}
              {module === 'media' && (
                <div className="cms-media-grid">
                  {[
                    snapshot.catalog.media.team,
                    snapshot.catalog.media.developers,
                    snapshot.catalog.media.workshop,
                    ...snapshot.catalog.items.flatMap((i) => (i.image ? [i.image] : [])),
                  ]
                    .filter((url, index, all) => all.indexOf(url) === index)
                    .map((url) => (
                      <figure key={url}>
                        <img src={url} alt="Available media asset" loading="lazy" />
                        <figcaption>{url}</figcaption>
                      </figure>
                    ))}
                </div>
              )}
            </>
          )}
          {preview && (
            <section className="cms-preview" aria-label="Draft preview">
              <h2>Draft preview</h2>
              <ContentContext.Provider value={snapshot.catalog}>
                {module === 'homepage' ? (
                  <FeatureCarousel />
                ) : module === 'items' && snapshot.catalog.items[selected] ? (
                  <ContentCard item={snapshot.catalog.items[selected]!} />
                ) : (
                  <CmsPreview module={module} snapshot={snapshot} selected={selected} />
                )}
              </ContentContext.Provider>
            </section>
          )}
          <datalist id="cms-ids">
            {[
              ...snapshot.catalog.items.map((i) => ({ id: i.id, title: i.title })),
              ...snapshot.catalog.courses.map((i) => ({ id: i.id, title: i.title })),
              ...state.accounts.map((i) => ({ id: i.id, title: i.name })),
            ].map((i) => (
              <option value={i.id} key={i.id}>
                {i.title}
              </option>
            ))}
          </datalist>
        </div>
      </div>
    </section>
  );
}
