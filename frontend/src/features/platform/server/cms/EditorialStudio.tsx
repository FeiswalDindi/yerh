import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { ContentBlock, ContentItem } from '../../../../domain/content';
import type { CmsMediaAsset } from '../../../../services/laravel-cms-repository';
import {
  editorialRepository,
  type EditorialRecord,
} from '../../../../services/laravel-editorial-repository';
import { ContentCard } from '../../../content/ContentCard';
import { PhotoFrame } from '../../../../shared/PhotoFrame';
import { StatusIndicator } from '../../../../shared/StatusIndicator';
import { ImageField } from './MediaPickerModal';

const kinds = { article: 'Article', story: 'Success Story', publication: 'Report' } as const;

type DraftState = {
  id?: number;
  kind: 'article' | 'story' | 'publication';
  title: string;
  category: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  videos: string[];
  linkedinUrl: string;
  storyGroups: ('Entrepreneur' | 'Startups')[];
  displayLine1: string;
  displayLine2: string;
  blocks: ContentBlock[];
  downloads: { label: string; href: string; availableLocally: boolean }[];
};

function toDraft(record?: EditorialRecord | null): DraftState {
  if (!record) {
    return {
      kind: 'article',
      title: '',
      category: 'Entrepreneurship',
      excerpt: '',
      image: '',
      imageAlt: '',
      status: 'draft',
      featured: false,
      videos: [''],
      linkedinUrl: '',
      storyGroups: ['Entrepreneur'],
      displayLine1: '',
      displayLine2: '',
      blocks: [{ type: 'paragraph', text: '' }],
      downloads: [],
    };
  }
  const c = record.content;
  return {
    id: record.id,
    kind: (c.kind === 'story' || c.kind === 'publication' ? c.kind : 'article') as
      'article' | 'story' | 'publication',
    title: c.title,
    category: c.category,
    excerpt: c.excerpt,
    image: c.image ?? '',
    imageAlt: c.imageAlt ?? '',
    status: record.status,
    featured: record.featured,
    videos: c.videos && c.videos.length > 0 ? [...c.videos] : [''],
    linkedinUrl: c.linkedinUrl ?? '',
    storyGroups:
      c.storyGroups && c.storyGroups.length > 0 ? [...c.storyGroups] : ['Entrepreneur'],
    displayLine1: c.displayLines?.line1 ?? '',
    displayLine2: c.displayLines?.line2 ?? '',
    blocks: c.blocks.length ? c.blocks : [{ type: 'paragraph', text: '' }],
    downloads: c.downloads ?? [],
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  if (item === undefined) return list;
  copy.splice(to, 0, item);
  return copy;
}

export function EditorialStudio({
  media,
  onUploaded,
  showPreview,
  viewport,
}: {
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  showPreview: boolean;
  viewport: 'desktop' | 'tablet' | 'mobile';
}) {
  const [records, setRecords] = useState<EditorialRecord[] | null>(null);
  const [filterKind, setFilterKind] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<DraftState>(() => toDraft());
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(toDraft()));
  const [previewMode, setPreviewMode] = useState<'article' | 'card'>('article');
  const [postsOpen, setPostsOpen] = useState(false);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function load(selectId?: number) {
    setError('');
    try {
      const list = await editorialRepository.entries();
      setRecords(list);
      if (selectId) {
        const found = list.find((item) => item.id === selectId);
        if (found) {
          const next = toDraft(found);
          setDraft(next);
          setBaseline(JSON.stringify(next));
        }
      } else if (list.length && !draft.id && !draft.title) {
        const next = toDraft(list[0]);
        setDraft(next);
        setBaseline(JSON.stringify(next));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load editorial posts.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveWithStatus(targetStatus: DraftState['status']) {
    if (formRef.current && !formRef.current.reportValidity()) return;
    if (draft.blocks.some((b) => !b.text.trim())) {
      setBlocksOpen(true);
      setError('Please complete all body blocks or remove empty blocks before saving.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const cleanedVideos = draft.videos.map((v) => v.trim()).filter(Boolean);
      const cleanedLine1 = draft.displayLine1.trim();
      const cleanedLine2 = draft.displayLine2.trim();
      const result = (await editorialRepository.save(
        {
          kind: draft.kind,
          title: draft.title.trim(),
          category: draft.category.trim(),
          excerpt: draft.excerpt.trim(),
          image: draft.image.trim() || null,
          imageAlt: draft.imageAlt.trim(),
          status: targetStatus,
          featured: draft.kind === 'story' ? draft.featured : false,
          videos: cleanedVideos,
          linkedinUrl: draft.linkedinUrl.trim() || null,
          ...(draft.kind === 'story'
            ? {
                storyGroups: draft.storyGroups,
                displayLines: { line1: cleanedLine1, line2: cleanedLine2 },
              }
            : {}),
          blocks: draft.blocks.map((b) => ({ type: b.type, text: b.text.trim() })),
          downloads: draft.downloads.filter((d) => d.label.trim() && d.href.trim()),
        },
        draft.id,
      )) as { data: { id: number } };
      await load(result.data.id);
      setNotice(
        targetStatus === 'published' ? 'Saved and published live.' : `Saved as ${targetStatus}.`,
      );
      window.dispatchEvent(new Event('yerh:editorial-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this post.');
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void saveWithStatus(draft.status);
  }

  async function removeCurrent() {
    if (!draft.id) return;
    if (!window.confirm(`Delete "${draft.title}" permanently?`)) return;
    setBusy(true);
    setError('');
    try {
      await editorialRepository.remove(draft.id);
      const blank = toDraft();
      setDraft(blank);
      setBaseline(JSON.stringify(blank));
      await load();
      setNotice('Post deleted.');
      window.dispatchEvent(new Event('yerh:editorial-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this post.');
    } finally {
      setBusy(false);
    }
  }

  const hasChanges = JSON.stringify(draft) !== baseline;

  const filtered = (records ?? []).filter(
    (entry) =>
      (filterKind === 'all' || entry.content.kind === filterKind) &&
      [entry.content.title, entry.content.category, entry.status]
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  const previewItem: ContentItem = {
    id: draft.id ? `preview-${draft.id}` : 'preview-new',
    slug: 'preview-post',
    kind: draft.kind,
    title: draft.title || 'Untitled post',
    category: draft.category || 'Entrepreneurship',
    excerpt: draft.excerpt || 'Your summary appears here.',
    image: draft.image || null,
    imageAlt: draft.imageAlt || draft.title,
    publishedAt: new Date().toISOString().slice(0, 10),
    blocks: draft.blocks,
    downloads: draft.downloads,
    videos: draft.videos.map((v) => v.trim()).filter(Boolean),
    linkedinUrl: draft.linkedinUrl.trim() || undefined,
    storyGroups: draft.kind === 'story' ? draft.storyGroups : undefined,
    displayLines:
      draft.kind === 'story' && (draft.displayLine1.trim() || draft.displayLine2.trim())
        ? {
            line1: draft.displayLine1.trim() || draft.title || 'Untitled story',
            line2: draft.displayLine2.trim() || draft.excerpt || '',
          }
        : undefined,
    source: { path: 'laravel-editorial', url: '', sha256: '' },
  };

  const showPostsList = postsOpen || query.trim().length > 0 || filterKind !== 'all';

  return (
    <div className={`cms-studio-split${showPreview ? '' : ' is-preview-hidden'}`}>
      <div className="cms-editor-stack">
        <section className="cms-card">
          <div className="cms-card-header">
            <div>
              <h2>Posts ({records?.length ?? 0})</h2>
              {!showPostsList && (
                <p className="cms-helper-text">
                  Editing: <strong>{draft.title || 'New post'}</strong>
                </p>
              )}
            </div>
            <div className="cms-icon-row">
              <button
                type="button"
                className="cms-icon-btn"
                aria-expanded={postsOpen}
                onClick={() => setPostsOpen((v) => !v)}
              >
                {postsOpen ? (
                  <>
                    <ChevronUp size={14} /> Hide list
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Switch post ({records?.length ?? 0})
                  </>
                )}
              </button>
              <button
                type="button"
                className="button button-small"
                onClick={() => {
                  const blank = toDraft();
                  setDraft(blank);
                  setBaseline(JSON.stringify(blank));
                  setNotice('');
                  setError('');
                }}
              >
                <Plus size={14} /> New post
              </button>
            </div>
          </div>

          <div className="cms-filter-bar">
            <div className="cms-subtabs" role="tablist" aria-label="Filter posts by type">
              {(
                [
                  ['all', 'All'],
                  ['article', 'Articles'],
                  ['story', 'Stories'],
                  ['publication', 'Reports'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="cms-subtab-btn"
                  aria-pressed={filterKind === key}
                  onClick={() => setFilterKind(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Search posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {showPostsList && (
            <div className="cms-editorial-list">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="cms-editorial-item"
                  aria-current={draft.id === entry.id ? 'true' : undefined}
                  onClick={() => {
                    const next = toDraft(entry);
                    setDraft(next);
                    setBaseline(JSON.stringify(next));
                    setNotice('');
                    setError('');
                    setPostsOpen(false);
                  }}
                >
                  <div>
                    <strong>{entry.content.title}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--yerh-muted)' }}>
                      {kinds[entry.content.kind as keyof typeof kinds] ?? entry.content.kind} ·{' '}
                      {entry.content.category}
                      {entry.content.kind === 'story' && entry.featured ? ' · On My Story' : ''}
                    </div>
                  </div>
                  <StatusIndicator status={entry.status} />
                </button>
              ))}
              {records && filtered.length === 0 && (
                <p className="cms-helper-text">No posts match your filter.</p>
              )}
            </div>
          )}
        </section>

        <form
          ref={formRef}
          className={`cms-card${hasChanges ? ' is-dirty' : ''}`}
          onSubmit={(e) => save(e)}
        >
          <div className="cms-card-header">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
              <h2>{draft.id ? `Editing: ${draft.title}` : 'Create new post'}</h2>
              <StatusIndicator status={draft.status} />
            </div>
            {draft.id && (
              <button
                type="button"
                className="cms-icon-btn is-danger"
                disabled={busy}
                onClick={() => void removeCurrent()}
              >
                <Trash2 size={13} /> Delete post
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="form-success">
              {notice}
            </p>
          )}

          <div className="cms-field-grid">
            {!draft.id && (
              <label className="cms-field-label">
                Type
                <select
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value as 'article' | 'story' | 'publication',
                    })
                  }
                >
                  {Object.entries(kinds).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="cms-field-label">
              Category
              <input
                required
                maxLength={80}
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </label>
            <label className="cms-field-label">
              Publication status
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.value as 'draft' | 'published' | 'archived',
                  })
                }
              >
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published (live)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <label className="cms-field-label">
            Title
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Write a clear, compelling headline"
            />
          </label>

          <label className="cms-field-label">
            Summary / excerpt
            <textarea
              required
              maxLength={500}
              rows={2}
              value={draft.excerpt}
              onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            />
          </label>

          <div className="cms-item-card">
            <div className="cms-item-toolbar">
              <strong style={{ fontSize: '0.88rem' }}>Video &amp; social links</strong>
              <button
                type="button"
                className="cms-icon-btn"
                onClick={() => setDraft({ ...draft, videos: [...draft.videos, ''] })}
              >
                <Plus size={13} /> Add video link
              </button>
            </div>
            <div className="cms-field-grid">
              <label className="cms-field-label">
                YouTube video URL
                <input
                  type="url"
                  maxLength={500}
                  value={draft.videos[0] ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      videos: [e.target.value, ...draft.videos.slice(1)],
                    })
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>
              <label className="cms-field-label">
                LinkedIn profile / post URL
                <input
                  type="url"
                  maxLength={500}
                  value={draft.linkedinUrl}
                  onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })}
                  placeholder="https://www.linkedin.com/in/..."
                />
              </label>
            </div>
            {draft.videos.slice(1).map((vid, extraIdx) => {
              const videoIndex = extraIdx + 1;
              return (
                <div className="cms-inline-link-row" key={videoIndex}>
                  <label className="cms-field-label" style={{ flex: 1 }}>
                    Additional YouTube URL #{videoIndex + 1}
                    <input
                      type="url"
                      maxLength={500}
                      value={vid}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          videos: draft.videos.map((v, i) =>
                            i === videoIndex ? e.target.value : v,
                          ),
                        })
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </label>
                  <button
                    type="button"
                    className="cms-icon-btn is-danger"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        videos: draft.videos.filter((_, i) => i !== videoIndex),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {draft.kind === 'story' && (
            <div className="cms-item-card">
              <strong style={{ fontSize: '0.88rem' }}>Homepage &ldquo;My Story&rdquo; display</strong>
              <label className="inline-checkbox">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                />{' '}
                Show this story on the front homepage under &ldquo;My Story&rdquo;
              </label>
              <div className="cms-icon-row">
                <span className="cms-helper-text">My Story filter tabs:</span>
                {(['Entrepreneur', 'Startups'] as const).map((group) => (
                  <label key={group} className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.storyGroups.includes(group)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          storyGroups: e.target.checked
                            ? [...new Set([...draft.storyGroups, group])]
                            : draft.storyGroups.filter((g) => g !== group),
                        })
                      }
                    />{' '}
                    {group}
                  </label>
                ))}
              </div>
              <div className="cms-field-grid">
                <label className="cms-field-label">
                  Homepage card line 1 (name / role)
                  <input
                    maxLength={120}
                    value={draft.displayLine1}
                    onChange={(e) => setDraft({ ...draft, displayLine1: e.target.value })}
                    placeholder={draft.title || 'e.g. Debbie Gitonga - Entrepreneur'}
                  />
                </label>
                <label className="cms-field-label">
                  Homepage card line 2 (venture / subtitle)
                  <input
                    maxLength={160}
                    value={draft.displayLine2}
                    onChange={(e) => setDraft({ ...draft, displayLine2: e.target.value })}
                    placeholder={draft.excerpt || 'e.g. DWG Sole Proprietor'}
                  />
                </label>
              </div>
            </div>
          )}

          <ImageField
            label="Cover image"
            value={draft.image}
            onChange={(image) => setDraft({ ...draft, image })}
            alt={draft.imageAlt}
            onAltChange={(imageAlt) => setDraft({ ...draft, imageAlt })}
            folder="editorial"
            media={media}
            onUploaded={onUploaded}
          />

          <div className="cms-collapsible-panel">
            <div className="cms-card-header">
              <h3>Body blocks ({draft.blocks.length})</h3>
              <div className="cms-icon-row">
                <button
                  type="button"
                  className="cms-icon-btn"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      blocks: [...draft.blocks, { type: 'paragraph', text: '' }],
                    });
                    setBlocksOpen(true);
                  }}
                >
                  <Plus size={13} /> Paragraph
                </button>
                <button
                  type="button"
                  className="cms-icon-btn"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      blocks: [...draft.blocks, { type: 'heading', text: '' }],
                    });
                    setBlocksOpen(true);
                  }}
                >
                  <Plus size={13} /> Heading
                </button>
                <button
                  type="button"
                  className="cms-icon-btn"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      blocks: [...draft.blocks, { type: 'list-item', text: '' }],
                    });
                    setBlocksOpen(true);
                  }}
                >
                  <Plus size={13} /> Bullet
                </button>
                <button
                  type="button"
                  className="cms-icon-btn"
                  aria-expanded={blocksOpen}
                  onClick={() => setBlocksOpen((v) => !v)}
                >
                  {blocksOpen ? (
                    <>
                      <ChevronUp size={14} /> Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Expand
                    </>
                  )}
                </button>
              </div>
            </div>

            {!blocksOpen ? (
              <div className="cms-collapse-bar">
                <div className="cms-collapse-summary">
                  {(() => {
                    const p = draft.blocks.filter((b) => b.type === 'paragraph').length;
                    const h = draft.blocks.filter((b) => b.type === 'heading').length;
                    const l = draft.blocks.filter((b) => b.type === 'list-item').length;
                    const summary = [
                      p ? `${p} ${p === 1 ? 'paragraph' : 'paragraphs'}` : '',
                      h ? `${h} ${h === 1 ? 'heading' : 'headings'}` : '',
                      l ? `${l} ${l === 1 ? 'bullet' : 'bullets'}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <span>
                        <strong>{summary || '0 blocks'}</strong> · Click Expand to edit article
                        sections and paragraphs.
                      </span>
                    );
                  })()}
                </div>
              </div>
            ) : (
              draft.blocks.map((block, index) => (
                <div className="cms-item-card" key={index}>
                  <div className="cms-item-toolbar">
                    <select
                      aria-label={`Block ${index + 1} type`}
                      value={block.type}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          blocks: draft.blocks.map((b, i) =>
                            i === index
                              ? { ...b, type: e.target.value as ContentBlock['type'] }
                              : b,
                          ),
                        })
                      }
                    >
                      <option value="paragraph">Paragraph</option>
                      <option value="heading">Section Heading</option>
                      <option value="list-item">Bullet List Item</option>
                    </select>
                    <div className="cms-icon-row">
                      <button
                        type="button"
                        className="cms-icon-btn"
                        disabled={index === 0}
                        onClick={() =>
                          setDraft({ ...draft, blocks: move(draft.blocks, index, index - 1) })
                        }
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="cms-icon-btn"
                        disabled={index >= draft.blocks.length - 1}
                        onClick={() =>
                          setDraft({ ...draft, blocks: move(draft.blocks, index, index + 1) })
                        }
                      >
                        <ArrowDown size={13} />
                      </button>
                      {draft.blocks.length > 1 && (
                        <button
                          type="button"
                          className="cms-icon-btn is-danger"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              blocks: draft.blocks.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    required
                    maxLength={12000}
                    rows={block.type === 'paragraph' ? 4 : 2}
                    value={block.text}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.map((b, i) =>
                          i === index ? { ...b, text: e.target.value } : b,
                        ),
                      })
                    }
                    placeholder={
                      block.type === 'heading' ? 'Section heading…' : 'Write block text…'
                    }
                  />
                </div>
              ))
            )}
          </div>

          {(hasChanges || Boolean(draft.id && draft.status === 'draft')) && (
            <div className="cms-card-actionbar">
              <span className="cms-card-actionbar-status">
                <Save size={14} aria-hidden="true" />
                {hasChanges ? 'Unsaved post changes' : 'Saved draft ready to publish'}
              </span>
              <div className="cms-icon-row">
                {hasChanges && (
                  <button
                    type="button"
                    className="cms-icon-btn is-danger"
                    disabled={busy}
                    onClick={() => {
                      setDraft(JSON.parse(baseline) as DraftState);
                      setNotice('');
                      setError('');
                    }}
                  >
                    <RotateCcw size={13} /> Reset changes
                  </button>
                )}
                {hasChanges && draft.status === 'archived' && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={busy}
                    onClick={() => void saveWithStatus('archived')}
                  >
                    <Save size={14} /> Save archived
                  </button>
                )}
                {hasChanges && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={busy}
                    onClick={() => void saveWithStatus('draft')}
                  >
                    <Save size={14} /> {busy ? 'Saving…' : 'Save draft'}
                  </button>
                )}
                <button
                  type="button"
                  className="button button-small"
                  disabled={busy}
                  onClick={() => void saveWithStatus('published')}
                >
                  <UploadCloud size={14} /> {busy ? 'Publishing…' : 'Publish live'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {showPreview && (
        <aside className="cms-preview-pane" aria-label="Editorial live preview">
          <div className="cms-preview-bar">
            <strong>Live preview</strong>
            <div className="cms-icon-row">
              <button
                type="button"
                className="cms-icon-btn"
                onClick={() => setPreviewMode('article')}
              >
                Full post
              </button>
              <button type="button" className="cms-icon-btn" onClick={() => setPreviewMode('card')}>
                Card view
              </button>
            </div>
          </div>
          <div className="cms-preview-canvas">
            <div className="cms-preview-frame" data-viewport={viewport}>
              <div className="cms-preview-block">
                {previewMode === 'card' ? (
                  <ContentCard item={previewItem} />
                ) : (
                  <article>
                    <p className="eyebrow">{previewItem.category}</p>
                    <h1 style={{ marginTop: '0.25rem' }}>{previewItem.title}</h1>
                    <p style={{ color: 'var(--yerh-muted)' }}>{previewItem.excerpt}</p>
                    {previewItem.image && (
                      <PhotoFrame
                        className="cms-preview-photo-frame"
                        src={previewItem.image}
                        alt={previewItem.imageAlt}
                        downloadLabel={previewItem.title}
                        targetWidth={800}
                      />
                    )}
                    {previewItem.blocks.map((b, idx) =>
                      b.type === 'heading' ? (
                        <h2 key={idx}>{b.text || 'Heading'}</h2>
                      ) : b.type === 'list-item' ? (
                        <ul key={idx}>
                          <li>{b.text || 'Bullet item'}</li>
                        </ul>
                      ) : (
                        <p key={idx}>{b.text || 'Paragraph text…'}</p>
                      ),
                    )}
                  </article>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
