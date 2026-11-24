import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { HeroOverlayStyle, ManagedPage, SiteContent } from '../../../../domain/site';
import type { CmsMediaAsset } from '../../../../services/laravel-cms-repository';
import { CardActionBar, type CardActions } from './CardActionBar';
import {
  getDefaultManagedPage,
  getSystemPageEntry,
  lookupManagedPage,
  normalizePagePath,
  PAGE_CATEGORIES,
  SYSTEM_PAGE_REGISTRY,
  validateManagedPagePath,
  type PageCategoryId,
} from './cms-page-registry';
import { ImageField } from './MediaPickerModal';

function moveSection<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(to, 0, moved);
  return next;
}

function emptyPageFallback(path: string): ManagedPage {
  const leaf = path.split('/').filter(Boolean).pop() ?? 'page';
  const readable = leaf.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  return {
    eyebrow: 'YERH',
    title: readable || 'Page heading',
    description: '',
    sections: [],
  };
}

function isPageCustomized(path: string, site: SiteContent): boolean {
  const stored = lookupManagedPage(site.pages, path);
  if (!stored) return false;
  const fallback = getDefaultManagedPage(path);
  if (!fallback) return true;
  return (
    stored.eyebrow !== fallback.eyebrow ||
    stored.title !== fallback.title ||
    stored.description !== fallback.description ||
    Boolean(stored.heroImage?.trim()) ||
    stored.sections.length > 0
  );
}

function resolvePageForSite(site: SiteContent, path: string): ManagedPage {
  return (
    lookupManagedPage(site.pages, path) ?? getDefaultManagedPage(path) ?? emptyPageFallback(path)
  );
}

export function PagesHeroEditor({
  site,
  baselineSite,
  selectedPath,
  onSelectPath,
  onChange,
  media,
  onUploaded,
  cardActions,
}: {
  site: SiteContent;
  baselineSite?: SiteContent;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  onChange: (next: SiteContent) => void;
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  cardActions?: CardActions;
}) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<PageCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addMode, setAddMode] = useState<'route' | 'custom'>('route');
  const [newPathInput, setNewPathInput] = useState('');
  const [error, setError] = useState('');
  const [infoNote, setInfoNote] = useState('');

  const allPaths = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of SYSTEM_PAGE_REGISTRY) {
      if (!seen.has(entry.path)) {
        seen.add(entry.path);
        out.push(entry.path);
      }
    }
    for (const key of Object.keys(site.pages)) {
      const normalized = normalizePagePath(key);
      if (normalized && normalized !== '/' && !seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    }
    return out;
  }, [site.pages]);

  const normalizedSelected = normalizePagePath(selectedPath);
  const activePath = allPaths.includes(normalizedSelected) ? normalizedSelected : allPaths[0]!;
  const page = resolvePageForSite(site, activePath);
  const baselinePage = baselineSite ? resolvePageForSite(baselineSite, activePath) : page;
  const systemEntry = getSystemPageEntry(activePath);
  const isCustomRoute = !systemEntry;
  const customized = isPageCustomized(activePath, site);

  const categoryCounts = useMemo(() => {
    const counts: Record<PageCategoryId, number> = {
      all: allPaths.length,
      customized: 0,
      core: 0,
      resources: 0,
      publications: 0,
      benefits: 0,
      community: 0,
      legal: 0,
      custom: 0,
    };
    for (const path of allPaths) {
      if (isPageCustomized(path, site)) counts.customized += 1;
      const entry = getSystemPageEntry(path);
      if (entry) counts[entry.category] += 1;
      else counts.custom += 1;
    }
    return counts;
  }, [allPaths, site]);

  const filteredPaths = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allPaths.filter((path) => {
      const entry = getSystemPageEntry(path);
      if (categoryFilter === 'customized' && !isPageCustomized(path, site)) return false;
      if (categoryFilter === 'custom' && entry) return false;
      if (
        categoryFilter !== 'all' &&
        categoryFilter !== 'customized' &&
        categoryFilter !== 'custom' &&
        entry?.category !== categoryFilter
      ) {
        return false;
      }
      if (!query) return true;
      const resolved = resolvePageForSite(site, path);
      return [path, entry?.label ?? '', resolved.eyebrow, resolved.title]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [allPaths, categoryFilter, searchQuery, site]);

  const pagesDirectoryDirty = Boolean(
    baselineSite &&
    JSON.stringify(Object.keys(site.pages).map(normalizePagePath).sort()) !==
      JSON.stringify(Object.keys(baselineSite.pages).map(normalizePagePath).sort()),
  );

  const heroDirty = Boolean(
    baselineSite &&
    JSON.stringify({
      eyebrow: page.eyebrow,
      title: page.title,
      description: page.description,
      heroImage: page.heroImage ?? '',
      heroImageAlt: page.heroImageAlt ?? '',
      heroOverlay: page.heroOverlay ?? 'navy',
    }) !==
      JSON.stringify({
        eyebrow: baselinePage.eyebrow,
        title: baselinePage.title,
        description: baselinePage.description,
        heroImage: baselinePage.heroImage ?? '',
        heroImageAlt: baselinePage.heroImageAlt ?? '',
        heroOverlay: baselinePage.heroOverlay ?? 'navy',
      }),
  );

  const sectionsDirty = Boolean(
    baselineSite && JSON.stringify(page.sections) !== JSON.stringify(baselinePage.sections),
  );

  function writePageRecord(targetPath: string, nextPage: ManagedPage | null) {
    const normalized = normalizePagePath(targetPath);
    const updatedPages: Record<string, ManagedPage> = {};
    for (const [key, value] of Object.entries(site.pages)) {
      if (normalizePagePath(key) !== normalized) {
        updatedPages[key] = value;
      }
    }
    if (nextPage) {
      updatedPages[normalized] = nextPage;
    }
    onChange({ ...site, pages: updatedPages });
  }

  function updatePage(patch: Partial<ManagedPage>) {
    setInfoNote('');
    writePageRecord(activePath, { ...page, ...patch });
  }

  function handleAddPage(event?: FormEvent) {
    event?.preventDefault();
    setInfoNote('');
    const result = validateManagedPagePath(newPathInput, addMode);
    if (result.error) {
      setError(result.error);
      return;
    }

    setError('');
    setCategoryFilter('all');
    setSearchQuery('');

    if (allPaths.includes(result.path)) {
      setNewPathInput('');
      onSelectPath(result.path);
      setInfoNote(`Selected "${result.path}". Edit its hero or sections below.`);
      return;
    }

    const fallback = emptyPageFallback(result.path);
    writePageRecord(result.path, {
      ...fallback,
      title: fallback.title,
      description: 'Introduce this page or subpage for visitors.',
      sections: [{ title: 'Overview', body: 'Write the main content for this section.' }],
    });
    setNewPathInput('');
    onSelectPath(result.path);
    setInfoNote(`Added "${result.path}". Customize the hero and click Publish live when ready.`);
  }

  const hasActiveSearch = searchQuery.trim().length > 0;
  const showDirectoryList = directoryOpen || hasActiveSearch || categoryFilter !== 'all';

  return (
    <div className="cms-editor-stack">
      <section className={`cms-card${pagesDirectoryDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Pages &amp; subpages ({allPaths.length})</h2>
            {!showDirectoryList && (
              <p className="cms-helper-text">
                Editing: <strong>{activePath}</strong>
                {systemEntry ? ` · ${systemEntry.label}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            className="cms-icon-btn"
            aria-expanded={directoryOpen}
            onClick={() => setDirectoryOpen((v) => !v)}
          >
            {directoryOpen ? (
              <>
                <ChevronUp size={14} /> Collapse
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Switch / Add ({allPaths.length})
              </>
            )}
          </button>
        </div>

        <div className="cms-filter-bar">
          <select
            aria-label="Filter pages by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as PageCategoryId)}
          >
            {PAGE_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label} ({categoryCounts[cat.id]})
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Search pages and subpages"
            placeholder="Search by path, page name, or title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {(hasActiveSearch || categoryFilter !== 'all') && (
            <button
              type="button"
              className="cms-icon-btn"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
              }}
            >
              Clear
            </button>
          )}
        </div>

        {showDirectoryList && (
          <div className="cms-page-selector">
            {filteredPaths.map((path) => {
              const entry = getSystemPageEntry(path);
              const hasCustomization = isPageCustomized(path, site);
              return (
                <button
                  key={path}
                  type="button"
                  className="cms-page-chip"
                  aria-pressed={activePath === path}
                  title={entry ? `${entry.label} (${path})` : `Custom page (${path})`}
                  onClick={() => {
                    onSelectPath(path);
                    setError('');
                    setInfoNote('');
                  }}
                >
                  {hasCustomization && (
                    <span className="cms-page-chip-dot" aria-label="Customized" />
                  )}
                  <span>{path}</span>
                  {entry && <span className="cms-page-chip-tag">· {entry.label}</span>}
                </button>
              );
            })}
            {filteredPaths.length === 0 && (
              <p className="cms-helper-text">
                No pages match &ldquo;{searchQuery}&rdquo;.{' '}
                {directoryOpen
                  ? 'Add a new path below or clear your filter.'
                  : 'Clear search or click Switch / Add to create a route or custom page.'}
              </p>
            )}
          </div>
        )}

        {directoryOpen && (
          <form className="cms-item-card" onSubmit={handleAddPage}>
            <div className="cms-item-toolbar">
              <strong style={{ fontSize: '0.88rem' }}>
                Add an existing route, subpage, or custom page
              </strong>
              <div className="cms-subtabs" role="group" aria-label="Page creation mode">
                <button
                  type="button"
                  className="cms-subtab-btn"
                  aria-pressed={addMode === 'route'}
                  onClick={() => {
                    setAddMode('route');
                    setError('');
                  }}
                >
                  Any route / subpage
                </button>
                <button
                  type="button"
                  className="cms-subtab-btn"
                  aria-pressed={addMode === 'custom'}
                  onClick={() => {
                    setAddMode('custom');
                    setError('');
                  }}
                >
                  Custom /pages/…
                </button>
              </div>
            </div>

            <div className="cms-publish-note">
              <input
                value={newPathInput}
                onChange={(e) => {
                  setNewPathInput(e.target.value);
                  setError('');
                }}
                placeholder={
                  addMode === 'route'
                    ? 'e.g. /institutions/apply or /about/governance'
                    : 'e.g. cohort-2026 or programs/cohort-2026'
                }
                maxLength={120}
                style={{ flex: '1 1 18rem' }}
              />
              {addMode === 'route' && (
                <button
                  type="button"
                  className="cms-icon-btn"
                  title={`Start typing a subpage under ${activePath}`}
                  onClick={() => {
                    setNewPathInput(`${activePath}/`);
                    setError('');
                  }}
                >
                  Subpage of {activePath}
                </button>
              )}
              <button type="submit" className="button button-small">
                <Plus size={14} />{' '}
                {addMode === 'route' ? 'Add / open route' : 'Create /pages/… page'}
              </button>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {infoNote && (
              <p role="status" className="form-success">
                {infoNote}
              </p>
            )}
          </form>
        )}

        <CardActionBar
          dirty={pagesDirectoryDirty}
          section="site"
          actions={cardActions}
          summaryHint="Updated managed page list"
          onDiscard={
            baselineSite
              ? () => {
                  onChange({ ...site, pages: structuredClone(baselineSite.pages) });
                  onSelectPath('/about');
                }
              : undefined
          }
        />
      </section>

      <section className={`cms-card${heroDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.55rem' }}>
            <h2>Hero header · {activePath}</h2>
            <span className={`cms-source-badge${isCustomRoute ? ' is-uploaded' : ''}`}>
              {systemEntry ? systemEntry.label : 'Custom / added page'}
            </span>
          </div>
          <div className="cms-icon-row">
            <Link className="cms-icon-btn" to={activePath} target="_blank">
              Open live page <ExternalLink size={12} />
            </Link>
            {!isCustomRoute && customized && (
              <button
                type="button"
                className="cms-icon-btn"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Reset hero and sections for ${activePath} back to the built-in default?`,
                    )
                  ) {
                    return;
                  }
                  writePageRecord(activePath, null);
                  setInfoNote(`Reset ${activePath} to built-in defaults.`);
                }}
              >
                <RotateCcw size={13} /> Reset to default
              </button>
            )}
            {isCustomRoute && (
              <button
                type="button"
                className="cms-icon-btn is-danger"
                onClick={() => {
                  if (!window.confirm(`Delete page ${activePath}?`)) return;
                  writePageRecord(activePath, null);
                  onSelectPath('/about');
                }}
              >
                <Trash2 size={13} /> Delete page
              </button>
            )}
          </div>
        </div>

        <div className="cms-field-grid">
          <label className="cms-field-label">
            Hero eyebrow / breadcrumb label
            <input
              value={page.eyebrow}
              maxLength={80}
              onChange={(e) => updatePage({ eyebrow: e.target.value })}
            />
          </label>
          <label className="cms-field-label">
            Hero title
            <input
              value={page.title}
              maxLength={140}
              onChange={(e) => updatePage({ title: e.target.value })}
            />
          </label>
        </div>
        <label className="cms-field-label">
          Hero subtitle / description
          <textarea
            value={page.description}
            maxLength={400}
            rows={3}
            onChange={(e) => updatePage({ description: e.target.value })}
          />
        </label>
        <ImageField
          label="Hero background photo (optional)"
          folder="hero"
          value={page.heroImage ?? ''}
          onChange={(heroImage) => updatePage({ heroImage })}
          alt={page.heroImageAlt ?? ''}
          onAltChange={(heroImageAlt) => updatePage({ heroImageAlt })}
          media={media}
          onUploaded={onUploaded}
        />
        {Boolean(page.heroImage?.trim()) && (
          <label className="cms-field-label">
            <span>Hero readability filter</span>
            <select
              value={page.heroOverlay ?? 'navy'}
              onChange={(e) => updatePage({ heroOverlay: e.target.value as HeroOverlayStyle })}
            >
              <option value="navy">Navy contrast filter (recommended)</option>
              <option value="dark">Charcoal dark scrim</option>
              <option value="gradient">Deep bottom vignette</option>
              <option value="soft">Soft dark tint (for darker photos)</option>
            </select>
          </label>
        )}

        <CardActionBar
          dirty={heroDirty}
          section="site"
          actions={cardActions}
          summaryHint={`Updated hero header for ${activePath}`}
          onDiscard={
            baselineSite
              ? () => {
                  const hadBaselineKey = Boolean(lookupManagedPage(baselineSite.pages, activePath));
                  if (!hadBaselineKey && !page.sections.length) {
                    writePageRecord(activePath, null);
                    return;
                  }
                  updatePage({
                    eyebrow: baselinePage.eyebrow,
                    title: baselinePage.title,
                    description: baselinePage.description,
                    heroImage: baselinePage.heroImage,
                    heroImageAlt: baselinePage.heroImageAlt,
                    heroOverlay: baselinePage.heroOverlay,
                  });
                }
              : undefined
          }
        />
      </section>

      <section className={`cms-card${sectionsDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Page sections ({page.sections.length})</h2>
            {!sectionsOpen && (
              <p className="cms-helper-text">
                {page.sections.length === 0
                  ? 'No extra content sections on this page.'
                  : page.sections.map((s) => s.title || 'Untitled section').join(' · ')}
              </p>
            )}
          </div>
          <div className="cms-icon-row">
            <button
              type="button"
              className="cms-icon-btn"
              onClick={() => {
                const nextSections = [
                  ...page.sections,
                  { title: 'New section', body: 'Add clear, concise details for visitors.' },
                ];
                updatePage({ sections: nextSections });
                setSectionsOpen(true);
                setOpenSectionIndex(nextSections.length - 1);
              }}
            >
              <Plus size={14} /> Add section
            </button>
            <button
              type="button"
              className="cms-icon-btn"
              aria-expanded={sectionsOpen}
              onClick={() => setSectionsOpen((v) => !v)}
            >
              {sectionsOpen ? (
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

        {sectionsOpen &&
          (page.sections.length === 0 ? (
            <p className="cms-helper-text">
              No custom sections added to {activePath} yet. Click Add section above to add content
              blocks below the main page content.
            </p>
          ) : (
            <div className="cms-accordion-list">
              {page.sections.map((section, index) => {
                const isOpen = openSectionIndex === index;
                return (
                  <div className={`cms-accordion-item${isOpen ? ' is-open' : ''}`} key={index}>
                    <div className="cms-accordion-row">
                      <div className="cms-accordion-main">
                        <div className="cms-accordion-text">
                          <strong>
                            Section {index + 1}: {section.title || 'Untitled'}
                          </strong>
                          <small>{section.body}</small>
                        </div>
                      </div>
                      <div className="cms-icon-row">
                        <button
                          type="button"
                          className="cms-icon-btn"
                          onClick={() => setOpenSectionIndex(isOpen ? null : index)}
                        >
                          {isOpen ? (
                            <>
                              <ChevronUp size={13} /> Done
                            </>
                          ) : (
                            <>
                              <ChevronDown size={13} /> Edit
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="cms-icon-btn"
                          disabled={index === 0}
                          onClick={() => {
                            updatePage({ sections: moveSection(page.sections, index, index - 1) });
                            if (openSectionIndex === index) setOpenSectionIndex(index - 1);
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="cms-icon-btn"
                          disabled={index >= page.sections.length - 1}
                          onClick={() => {
                            updatePage({ sections: moveSection(page.sections, index, index + 1) });
                            if (openSectionIndex === index) setOpenSectionIndex(index + 1);
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          className="cms-icon-btn is-danger"
                          onClick={() => {
                            updatePage({
                              sections: page.sections.filter((_, i) => i !== index),
                            });
                            if (openSectionIndex === index) setOpenSectionIndex(null);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="cms-accordion-body">
                        <label className="cms-field-label">
                          Section heading
                          <input
                            value={section.title}
                            maxLength={140}
                            onChange={(e) =>
                              updatePage({
                                sections: page.sections.map((s, i) =>
                                  i === index ? { ...s, title: e.target.value } : s,
                                ),
                              })
                            }
                          />
                        </label>
                        <label className="cms-field-label">
                          Section text
                          <textarea
                            value={section.body}
                            maxLength={4000}
                            rows={4}
                            onChange={(e) =>
                              updatePage({
                                sections: page.sections.map((s, i) =>
                                  i === index ? { ...s, body: e.target.value } : s,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

        <CardActionBar
          dirty={sectionsDirty}
          section="site"
          actions={cardActions}
          summaryHint={`Updated page sections for ${activePath}`}
          onDiscard={
            baselineSite
              ? () => {
                  const hadBaselineKey = Boolean(lookupManagedPage(baselineSite.pages, activePath));
                  const restoredSections = structuredClone(baselinePage.sections);
                  if (!hadBaselineKey && !heroDirty) {
                    writePageRecord(activePath, null);
                    return;
                  }
                  updatePage({ sections: restoredSections });
                }
              : undefined
          }
        />
      </section>
    </div>
  );
}
