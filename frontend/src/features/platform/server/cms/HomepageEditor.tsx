import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCatalog } from '../../../../app/useCatalog';
import { laravelModeEnabled } from '../../../../config/laravel';
import type { HeroSlide, HeroSlideTheme, HomepageContent } from '../../../../domain/hub';
import {
  DEFAULT_HOME_SIDEBAR_ORDER,
  normalizeHomeSidebarOrder,
  type HomeSidebarWidgetKey,
  type SiteContent,
} from '../../../../domain/site';
import type { CmsLiveStats, CmsMediaAsset } from '../../../../services/laravel-cms-repository';
import {
  editorialRepository,
  type EditorialRecord,
} from '../../../../services/laravel-editorial-repository';
import { SmartImage } from '../../../../shared/SmartImage';
import { StatusIndicator } from '../../../../shared/StatusIndicator';
import { CardActionBar, type CardActions } from './CardActionBar';
import { ImageField } from './MediaPickerModal';
import { collectSiteLibrary } from './site-library';

const quickRoutes = [
  ['/entrepreneurship/startups', 'Startups pathway'],
  ['/learn', 'Courses catalogue'],
  ['/opportunities', 'Opportunities'],
  ['/events', 'Events'],
  ['/marketplace', 'Shop'],
  ['/forums', 'Forums'],
  ['/network', 'YERH Network'],
  ['/publications/stories', 'Success stories'],
  ['/resources', 'Resources'],
  ['/institutions/apply', 'Partner institution onboarding'],
  ['/about', 'About Us'],
  ['/contact', 'Contact Us'],
];

const sidebarWidgetMeta: Record<
  HomeSidebarWidgetKey,
  { label: string; description: string; sectionKey: string }
> = {
  news: {
    label: "Entrepreneur's News Feed",
    description: 'Latest published blog headlines and updates.',
    sectionKey: 'blogs',
  },
  links: {
    label: 'Important Links',
    description: 'Quick navigation buttons managed below.',
    sectionKey: 'links',
  },
  partners: {
    label: 'Our Partners',
    description: 'Partner institution logos and links.',
    sectionKey: 'partners',
  },
  statistics: {
    label: 'Our Numbers',
    description: 'Live platform counts or custom impact statistics.',
    sectionKey: 'statistics',
  },
  socials: {
    label: 'Social Media & Featured Video',
    description: 'Social channel buttons and embedded YouTube video.',
    sectionKey: 'socials',
  },
};

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  if (item === undefined) return list;
  copy.splice(to, 0, item);
  return copy;
}

export function HomepageEditor({
  homepage,
  site,
  baselineHomepage,
  baselineSite,
  liveStats,
  selectedSlide,
  onSelectSlide,
  onChangeHomepage,
  onChangeSite,
  media,
  onUploaded,
  cardActions,
}: {
  homepage: HomepageContent;
  site: SiteContent;
  baselineHomepage?: HomepageContent;
  baselineSite?: SiteContent;
  liveStats: CmsLiveStats | null;
  selectedSlide: number;
  onSelectSlide: (index: number) => void;
  onChangeHomepage: (next: HomepageContent) => void;
  onChangeSite: (next: SiteContent) => void;
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  cardActions?: CardActions;
}) {
  const catalog = useCatalog();
  const [slidesCardOpen, setSlidesCardOpen] = useState(false);
  const [slideListOpen, setSlideListOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [myStoryOpen, setMyStoryOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [slideSearch, setSlideSearch] = useState('');
  const [slideFilter, setSlideFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [pickerStripSource, setPickerStripSource] = useState<'all' | 'uploaded' | 'site'>('all');

  const [storyRecords, setStoryRecords] = useState<EditorialRecord[] | null>(null);
  const [editingStoryId, setEditingStoryId] = useState<number | null>(null);
  const [storyLinksForm, setStoryLinksForm] = useState<{
    videoUrl: string;
    linkedinUrl: string;
    storyGroups: ('Entrepreneur' | 'Startups')[];
    line1: string;
    line2: string;
  }>({ videoUrl: '', linkedinUrl: '', storyGroups: ['Entrepreneur'], line1: '', line2: '' });
  const [storySaving, setStorySaving] = useState(false);
  const [storySaveNote, setStorySaveNote] = useState('');
  const [storySaveError, setStorySaveError] = useState('');

  useEffect(() => {
    if (!laravelModeEnabled) return;
    let active = true;
    const controller = new AbortController();
    const fetchStories = () => {
      void editorialRepository
        .entries(controller.signal)
        .then((list) => {
          if (active) setStoryRecords(list.filter((entry) => entry.content.kind === 'story'));
        })
        .catch(() => {});
    };
    fetchStories();
    window.addEventListener('yerh:editorial-updated', fetchStories);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('yerh:editorial-updated', fetchStories);
    };
  }, []);

  const myStoryDirty = Boolean(
    baselineHomepage &&
    JSON.stringify({
      myStoryTitle: homepage.myStoryTitle ?? '',
      myStorySubtitle: homepage.myStorySubtitle ?? '',
      featuredStories: homepage.featuredStories,
    }) !==
      JSON.stringify({
        myStoryTitle: baselineHomepage.myStoryTitle ?? '',
        myStorySubtitle: baselineHomepage.myStorySubtitle ?? '',
        featuredStories: baselineHomepage.featuredStories,
      }),
  );

  const slides = homepage.slides;
  const activeCount = slides.filter((s) => !s.archived).length;
  const archivedCount = slides.length - activeCount;

  const hasSlideSearch = slideSearch.trim().length > 0;
  const visibleSlideEntries = useMemo(() => {
    const query = slideSearch.trim().toLowerCase();
    return slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide, index }) => {
        if (slideFilter === 'active' && slide.archived) return false;
        if (slideFilter === 'archived' && !slide.archived) return false;
        if (!query) return true;
        return [
          `slide ${index + 1}`,
          slide.eyebrow,
          slide.title,
          slide.secondLine,
          slide.accent,
          slide.text,
          slide.href,
          slide.theme ?? 'photo',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
  }, [slides, slideFilter, slideSearch]);

  const effectiveSlideIndex = visibleSlideEntries.some((item) => item.index === selectedSlide)
    ? selectedSlide
    : (visibleSlideEntries[0]?.index ?? (slides.length > 0 ? 0 : -1));
  const activeSlide = effectiveSlideIndex >= 0 ? slides[effectiveSlideIndex] : undefined;

  const siteLibraryItems = useMemo(() => collectSiteLibrary(catalog, media), [catalog, media]);

  const quickImageChoices = useMemo(() => {
    const out: {
      key: string;
      url: string;
      label: string;
      alt: string;
      source: 'uploaded' | 'site';
    }[] = [];
    const seen = new Set<string>();

    if (pickerStripSource !== 'site') {
      for (const asset of media) {
        if (!asset.mime_type.startsWith('image/') || seen.has(asset.url)) continue;
        seen.add(asset.url);
        out.push({
          key: `up-${asset.id}`,
          url: asset.url,
          label: asset.original_name,
          alt: asset.alt_text || asset.original_name,
          source: 'uploaded',
        });
      }
    }

    if (pickerStripSource !== 'uploaded') {
      for (const item of siteLibraryItems) {
        if (!item.mimeType.startsWith('image/') || seen.has(item.url)) continue;
        seen.add(item.url);
        out.push({
          key: item.key,
          url: item.url,
          label: item.name,
          alt: item.alt,
          source: 'site',
        });
      }
    }

    return out;
  }, [media, siteLibraryItems, pickerStripSource]);

  const slidesDirty = Boolean(
    baselineHomepage && JSON.stringify(homepage.slides) !== JSON.stringify(baselineHomepage.slides),
  );
  const visibilityDirty = Boolean(
    baselineSite && JSON.stringify(site.homeSections) !== JSON.stringify(baselineSite.homeSections),
  );
  const sidebarOrder = normalizeHomeSidebarOrder(site.homeSidebarOrder);
  const sidebarOrderDirty = Boolean(
    baselineSite &&
    JSON.stringify(sidebarOrder) !==
      JSON.stringify(normalizeHomeSidebarOrder(baselineSite.homeSidebarOrder)),
  );
  const statsDirty = Boolean(
    baselineHomepage &&
    JSON.stringify({
      useLiveStats: Boolean(homepage.useLiveStats),
      statistics: homepage.statistics,
      statisticsNote: homepage.statisticsNote,
    }) !==
      JSON.stringify({
        useLiveStats: Boolean(baselineHomepage.useLiveStats),
        statistics: baselineHomepage.statistics,
        statisticsNote: baselineHomepage.statisticsNote,
      }),
  );
  const linksDirty = Boolean(
    baselineHomepage &&
    JSON.stringify({
      socialVideo: homepage.socialVideo,
      importantLinks: homepage.importantLinks,
    }) !==
      JSON.stringify({
        socialVideo: baselineHomepage.socialVideo,
        importantLinks: baselineHomepage.importantLinks,
      }),
  );

  function updateSlide(index: number, patch: Partial<HeroSlide>) {
    onChangeHomepage({
      ...homepage,
      slides: slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)),
    });
  }

  function addSlide() {
    const fresh: HeroSlide = {
      eyebrow: 'YOUTH ENTERPRISE HUB',
      title: 'Build your',
      secondLine: 'next',
      accent: 'venture.',
      text: 'Access practical guides, mentors, and funding opportunities across Kenya.',
      image: '/media/be-part-of-the-team-3382b8d1.webp',
      alt: 'Young entrepreneurs collaborating',
      href: '/resources',
      action: 'Explore resources',
      caption: 'Practical entrepreneurship support.',
      theme: 'photo',
      archived: false,
    };
    const next = [...slides, fresh];
    onChangeHomepage({ ...homepage, slides: next });
    setSlideFilter('all');
    setSlideSearch('');
    setSlidesCardOpen(true);
    onSelectSlide(next.length - 1);
  }

  return (
    <div className="cms-editor-stack">
      <section className={`cms-card${slidesDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>
              Hero carousel slides ({activeCount} live · {archivedCount} archived)
            </h2>
          </div>
          <div className="cms-icon-row">
            <button type="button" className="button button-small" onClick={addSlide}>
              <Plus size={14} /> Add slide
            </button>
            <button
              type="button"
              className="cms-icon-btn"
              aria-expanded={slidesCardOpen}
              onClick={() => setSlidesCardOpen((v) => !v)}
            >
              {slidesCardOpen ? (
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

        {!slidesCardOpen ? (
          <div className="cms-collapse-bar">
            <div className="cms-collapse-summary">
              <span>
                Active preview:{' '}
                <strong>
                  Slide {effectiveSlideIndex + 1}: {activeSlide?.title} {activeSlide?.accent}
                </strong>
              </span>
              {activeSlide?.archived && <span className="cms-source-badge">Archived</span>}
              <span>· Click Expand to edit slides, switch style themes, or archive slides.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="cms-collapse-bar">
              <div className="cms-collapse-summary">
                <span>
                  Selected:{' '}
                  <strong>
                    Slide {effectiveSlideIndex + 1} of {slides.length}
                  </strong>
                </span>
              </div>
              <div className="cms-icon-row">
                <input
                  type="search"
                  aria-label="Search slides"
                  placeholder="Search slides…"
                  value={slideSearch}
                  onChange={(e) => setSlideSearch(e.target.value)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    border: '1px solid var(--yerh-border)',
                    font: 'inherit',
                    fontSize: '0.84rem',
                    minWidth: '12rem',
                  }}
                />
                {hasSlideSearch && (
                  <button type="button" className="cms-icon-btn" onClick={() => setSlideSearch('')}>
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className="cms-icon-btn"
                  aria-expanded={slideListOpen || hasSlideSearch}
                  onClick={() => setSlideListOpen((v) => !v)}
                >
                  {slideListOpen ? (
                    <>
                      <ChevronUp size={14} /> Hide slide list
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> All slides ({slides.length})
                    </>
                  )}
                </button>
              </div>
            </div>

            {activeCount === 0 && (
              <p role="status" className="form-error">
                All slides are currently archived. Restore at least one slide before publishing if
                you want the hero slider visible on the homepage.
              </p>
            )}

            {(slideListOpen || hasSlideSearch) && (
              <>
                <div
                  className="cms-page-selector"
                  role="group"
                  aria-label="Filter slides by status"
                >
                  {(
                    [
                      ['all', `All slides (${slides.length})`],
                      ['active', `Live on site (${activeCount})`],
                      ['archived', `Archived (${archivedCount})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className="cms-page-chip"
                      aria-pressed={slideFilter === key}
                      onClick={() => {
                        setSlideFilter(key);
                        const firstMatch = slides.findIndex((s) =>
                          key === 'active'
                            ? !s.archived
                            : key === 'archived'
                              ? Boolean(s.archived)
                              : true,
                        );
                        if (firstMatch >= 0) onSelectSlide(firstMatch);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="cms-page-selector">
                  {visibleSlideEntries.map(({ slide, index }) => (
                    <button
                      key={index}
                      type="button"
                      className={`cms-page-chip${slide.archived ? ' is-archived' : ''}`}
                      aria-pressed={effectiveSlideIndex === index}
                      onClick={() => onSelectSlide(index)}
                    >
                      <span>
                        Slide {index + 1}: {slide.title} {slide.accent}
                      </span>
                      {slide.archived && <span className="cms-page-chip-tag">(Archived)</span>}
                    </button>
                  ))}
                  {visibleSlideEntries.length === 0 && (
                    <p style={{ margin: 0, color: 'var(--yerh-muted)' }}>
                      No slides match your search or filter.
                    </p>
                  )}
                </div>
              </>
            )}

            {activeSlide && effectiveSlideIndex >= 0 && (
              <div className="cms-item-card is-selected">
                <div className="cms-item-toolbar">
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.55rem',
                    }}
                  >
                    <strong>Editing Slide {effectiveSlideIndex + 1}</strong>
                    <StatusIndicator
                      status={activeSlide.archived ? 'archived' : 'published'}
                      label={activeSlide.archived ? 'Archived (hidden)' : 'Live on homepage'}
                      size={15}
                    />
                  </div>
                  <div className="cms-icon-row">
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={effectiveSlideIndex === 0}
                      onClick={() => {
                        onChangeHomepage({
                          ...homepage,
                          slides: moveItem(slides, effectiveSlideIndex, effectiveSlideIndex - 1),
                        });
                        onSelectSlide(effectiveSlideIndex - 1);
                      }}
                    >
                      <ArrowUp size={13} /> Move up
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={effectiveSlideIndex >= slides.length - 1}
                      onClick={() => {
                        onChangeHomepage({
                          ...homepage,
                          slides: moveItem(slides, effectiveSlideIndex, effectiveSlideIndex + 1),
                        });
                        onSelectSlide(effectiveSlideIndex + 1);
                      }}
                    >
                      <ArrowDown size={13} /> Move down
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      onClick={() => {
                        const copy = {
                          ...activeSlide,
                          title: `${activeSlide.title} (Copy)`,
                          archived: false,
                        };
                        const next = [...slides, copy];
                        onChangeHomepage({ ...homepage, slides: next });
                        setSlideFilter('all');
                        onSelectSlide(next.length - 1);
                      }}
                    >
                      <Copy size={13} /> Duplicate
                    </button>
                    <button
                      type="button"
                      className={`cms-icon-btn${activeSlide.archived ? ' is-active' : ''}`}
                      onClick={() =>
                        updateSlide(effectiveSlideIndex, { archived: !activeSlide.archived })
                      }
                    >
                      {activeSlide.archived ? (
                        <>
                          <ArchiveRestore size={13} /> Restore
                        </>
                      ) : (
                        <>
                          <Archive size={13} /> Archive
                        </>
                      )}
                    </button>
                    {slides.length > 1 && (
                      <button
                        type="button"
                        className="cms-icon-btn is-danger"
                        onClick={() => {
                          const next = slides.filter((_, i) => i !== effectiveSlideIndex);
                          onChangeHomepage({ ...homepage, slides: next });
                          onSelectSlide(Math.max(0, effectiveSlideIndex - 1));
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="cms-field-grid">
                  <label className="cms-field-label">
                    Style theme
                    <select
                      value={activeSlide.theme ?? 'photo'}
                      onChange={(e) =>
                        updateSlide(effectiveSlideIndex, {
                          theme: e.target.value as HeroSlideTheme,
                        })
                      }
                    >
                      <optgroup label="Full-bleed photo styles (Media Library photos)">
                        <option value="photo">Navy gradient photo (default)</option>
                        <option value="dark">Charcoal editorial photo</option>
                        <option value="spotlight">Centered spotlight photo</option>
                        <option value="gold">Warm gold-tinted photo</option>
                        <option value="navy">Deep vignette photo (high contrast)</option>
                      </optgroup>
                      <optgroup label="Split showcase styles (flyers, illustrations & portraits)">
                        <option value="green">Emerald green split showcase</option>
                        <option value="split-navy">Royal navy split showcase</option>
                        <option value="split-gold">Warm gold split showcase</option>
                      </optgroup>
                    </select>
                  </label>
                  <label className="cms-field-label">
                    Eyebrow
                    <input
                      value={activeSlide.eyebrow}
                      maxLength={100}
                      onChange={(e) =>
                        updateSlide(effectiveSlideIndex, { eyebrow: e.target.value })
                      }
                    />
                  </label>
                  <label className="cms-field-label">
                    Headline start
                    <input
                      value={activeSlide.title}
                      maxLength={80}
                      onChange={(e) => updateSlide(effectiveSlideIndex, { title: e.target.value })}
                    />
                  </label>
                  <label className="cms-field-label">
                    Headline middle (optional)
                    <input
                      value={activeSlide.secondLine}
                      maxLength={60}
                      onChange={(e) =>
                        updateSlide(effectiveSlideIndex, { secondLine: e.target.value })
                      }
                    />
                  </label>
                  <label className="cms-field-label">
                    Gold accent word(s)
                    <input
                      value={activeSlide.accent}
                      maxLength={60}
                      onChange={(e) => updateSlide(effectiveSlideIndex, { accent: e.target.value })}
                    />
                  </label>
                  <label className="cms-field-label">
                    Button text
                    <input
                      value={activeSlide.action}
                      maxLength={60}
                      onChange={(e) => updateSlide(effectiveSlideIndex, { action: e.target.value })}
                    />
                  </label>
                  <label className="cms-field-label">
                    Button link
                    <input
                      list="cms-route-presets"
                      value={activeSlide.href}
                      maxLength={240}
                      onChange={(e) => updateSlide(effectiveSlideIndex, { href: e.target.value })}
                    />
                  </label>
                  <label className="cms-field-label">
                    Short caption
                    <input
                      value={activeSlide.caption}
                      maxLength={140}
                      onChange={(e) =>
                        updateSlide(effectiveSlideIndex, { caption: e.target.value })
                      }
                    />
                  </label>
                </div>

                <label className="cms-field-label">
                  Hero paragraph
                  <textarea
                    value={activeSlide.text}
                    maxLength={320}
                    rows={3}
                    onChange={(e) => updateSlide(effectiveSlideIndex, { text: e.target.value })}
                  />
                </label>

                <ImageField
                  label="Slide banner image"
                  value={activeSlide.image}
                  onChange={(url) => updateSlide(effectiveSlideIndex, { image: url })}
                  alt={activeSlide.alt}
                  onAltChange={(alt) => updateSlide(effectiveSlideIndex, { alt })}
                  folder="hero"
                  media={media}
                  onUploaded={onUploaded}
                />

                <div className="cms-media-strip-wrap">
                  <div className="cms-item-toolbar">
                    <strong
                      style={{
                        fontSize: '0.84rem',
                        display: 'inline-flex',
                        gap: '0.35rem',
                        alignItems: 'center',
                      }}
                    >
                      <ImagePlus size={14} aria-hidden="true" />
                      Quick-style from Media &amp; Site Library
                    </strong>
                    <div className="cms-page-selector">
                      {(
                        [
                          ['all', 'All'],
                          ['uploaded', 'Uploaded'],
                          ['site', 'Site library'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className="cms-page-chip"
                          aria-pressed={pickerStripSource === key}
                          onClick={() => setPickerStripSource(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cms-media-strip">
                    {quickImageChoices.map((choice) => (
                      <button
                        key={choice.key}
                        type="button"
                        className={`cms-media-strip-item${activeSlide.image === choice.url ? ' is-selected' : ''}`}
                        title={`${choice.label} (${choice.source === 'uploaded' ? 'Uploaded media' : 'Site library'})`}
                        onClick={() =>
                          updateSlide(effectiveSlideIndex, {
                            image: choice.url,
                            alt: (activeSlide.alt ?? '').trim() ? activeSlide.alt : choice.alt,
                          })
                        }
                      >
                        <SmartImage src={choice.url} alt={choice.alt} targetWidth={160} />
                        <span>{choice.label}</span>
                      </button>
                    ))}
                    {quickImageChoices.length === 0 && (
                      <small style={{ color: 'var(--yerh-muted)' }}>
                        No images available in this filter yet.
                      </small>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <CardActionBar
          dirty={slidesDirty}
          section="homepage"
          actions={cardActions}
          summaryHint="Updated homepage slider"
          onDiscard={
            baselineHomepage
              ? () => {
                  onChangeHomepage({
                    ...homepage,
                    slides: structuredClone(baselineHomepage.slides),
                  });
                  onSelectSlide(0);
                }
              : undefined
          }
        />
      </section>

      <section className={`cms-card${visibilityDirty || sidebarOrderDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Homepage sections &amp; sidebar order</h2>
            {!layoutOpen && (
              <p className="cms-helper-text">
                Main:{' '}
                {
                  (['stories', 'businesses', 'events', 'updates'] as const).filter(
                    (k) => site.homeSections[k] !== false,
                  ).length
                }
                /4 visible · Sidebar:{' '}
                {sidebarOrder.map((k) => sidebarWidgetMeta[k].label).join(' → ')}
              </p>
            )}
          </div>
          <button
            type="button"
            className="cms-icon-btn"
            aria-expanded={layoutOpen}
            onClick={() => setLayoutOpen((v) => !v)}
          >
            {layoutOpen ? (
              <>
                <ChevronUp size={14} /> Collapse
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Configure
              </>
            )}
          </button>
        </div>

        {layoutOpen && (
          <>
            <div className="cms-item-card">
              <strong style={{ fontSize: '0.88rem' }}>Main page sections</strong>
              <div className="cms-field-grid">
                {(
                  [
                    ['stories', 'Success Stories'],
                    ['businesses', 'Featured Businesses'],
                    ['events', 'Upcoming Events'],
                    ['updates', 'Latest Blogs & Updates'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={site.homeSections[key] !== false}
                      onChange={(e) =>
                        onChangeSite({
                          ...site,
                          homeSections: { ...site.homeSections, [key]: e.target.checked },
                        })
                      }
                    />{' '}
                    Show {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="cms-item-toolbar">
              <strong style={{ fontSize: '0.88rem' }}>Sidebar widget order &amp; visibility</strong>
              <button
                type="button"
                className="cms-icon-btn"
                onClick={() =>
                  onChangeSite({
                    ...site,
                    homeSidebarOrder: [...DEFAULT_HOME_SIDEBAR_ORDER],
                  })
                }
              >
                Reset order
              </button>
            </div>

            <div className="cms-accordion-list">
              {sidebarOrder.map((key, index) => {
                const meta = sidebarWidgetMeta[key];
                const visible = site.homeSections[meta.sectionKey] !== false;
                return (
                  <div className="cms-accordion-item" key={key}>
                    <div className="cms-accordion-row">
                      <div className="cms-accordion-main">
                        <div className="cms-accordion-text">
                          <strong>
                            #{index + 1} · {meta.label}
                          </strong>
                          <small>{meta.description}</small>
                        </div>
                      </div>
                      <div className="cms-icon-row">
                        <label className="inline-checkbox">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={(e) =>
                              onChangeSite({
                                ...site,
                                homeSections: {
                                  ...site.homeSections,
                                  [meta.sectionKey]: e.target.checked,
                                },
                              })
                            }
                          />{' '}
                          Show
                        </label>
                        <button
                          type="button"
                          className="cms-icon-btn"
                          aria-label={`Move ${meta.label} up`}
                          disabled={index === 0}
                          onClick={() =>
                            onChangeSite({
                              ...site,
                              homeSidebarOrder: moveItem(sidebarOrder, index, index - 1),
                            })
                          }
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="cms-icon-btn"
                          aria-label={`Move ${meta.label} down`}
                          disabled={index >= sidebarOrder.length - 1}
                          onClick={() =>
                            onChangeSite({
                              ...site,
                              homeSidebarOrder: moveItem(sidebarOrder, index, index + 1),
                            })
                          }
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <CardActionBar
          dirty={visibilityDirty || sidebarOrderDirty}
          section="site"
          actions={cardActions}
          summaryHint="Updated homepage sections and sidebar order"
          onDiscard={
            baselineSite
              ? () =>
                  onChangeSite({
                    ...site,
                    homeSections: structuredClone(baselineSite.homeSections),
                    homeSidebarOrder: normalizeHomeSidebarOrder(baselineSite.homeSidebarOrder),
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${myStoryDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>
              My Story section ({homepage.featuredStories.length} featured)
            </h2>
            {!myStoryOpen && (
              <p className="cms-helper-text">
                Heading: <strong>{homepage.myStoryTitle?.trim() || 'My Story'}</strong> · Choose
                which stories appear on the homepage and edit YouTube &amp; LinkedIn links.
              </p>
            )}
          </div>
          <button
            type="button"
            className="cms-icon-btn"
            aria-expanded={myStoryOpen}
            onClick={() => setMyStoryOpen((v) => !v)}
          >
            {myStoryOpen ? (
              <>
                <ChevronUp size={14} /> Collapse
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Configure
              </>
            )}
          </button>
        </div>

        {myStoryOpen && (
          <>
            <div className="cms-field-grid">
              <label className="cms-field-label">
                Section heading
                <input
                  value={homepage.myStoryTitle ?? ''}
                  maxLength={80}
                  placeholder="My Story"
                  onChange={(e) =>
                    onChangeHomepage({ ...homepage, myStoryTitle: e.target.value })
                  }
                />
              </label>
              <label className="cms-field-label">
                Optional subtitle
                <input
                  value={homepage.myStorySubtitle ?? ''}
                  maxLength={200}
                  placeholder="Inspiring voices from young entrepreneurs across the hub"
                  onChange={(e) =>
                    onChangeHomepage({ ...homepage, myStorySubtitle: e.target.value })
                  }
                />
              </label>
            </div>

            {storySaveError && (
              <p role="alert" className="form-error">
                {storySaveError}
              </p>
            )}
            {storySaveNote && (
              <p role="status" className="form-success">
                {storySaveNote}
              </p>
            )}

            {!laravelModeEnabled ? (
              <p className="cms-helper-text">
                Homepage stories and YouTube/LinkedIn links are managed in the live database server.
              </p>
            ) : !storyRecords ? (
              <p className="cms-helper-text">Loading published stories…</p>
            ) : (
              (() => {
                const publishedStories = storyRecords.filter((r) => r.status === 'published');
                const byContentId = new Map(
                  publishedStories.map((r) => [r.content.id, r]),
                );
                const featuredIds = homepage.featuredStories.filter((id) =>
                  byContentId.has(id),
                );
                const availableStories = publishedStories.filter(
                  (r) => !featuredIds.includes(r.content.id),
                );

                const openStoryLinkEditor = (record: EditorialRecord) => {
                  if (editingStoryId === record.id) {
                    setEditingStoryId(null);
                    return;
                  }
                  setStorySaveError('');
                  setStorySaveNote('');
                  setEditingStoryId(record.id);
                  setStoryLinksForm({
                    videoUrl: record.content.videos?.[0] ?? '',
                    linkedinUrl: record.content.linkedinUrl ?? '',
                    storyGroups:
                      record.content.storyGroups && record.content.storyGroups.length > 0
                        ? [...record.content.storyGroups]
                        : ['Entrepreneur'],
                    line1: record.content.displayLines?.line1 ?? '',
                    line2: record.content.displayLines?.line2 ?? '',
                  });
                };

                const saveStoryLinks = async (record: EditorialRecord) => {
                  setStorySaving(true);
                  setStorySaveError('');
                  setStorySaveNote('');
                  try {
                    const c = record.content;
                    const restVideos = (c.videos ?? []).slice(1);
                    const nextVideos = storyLinksForm.videoUrl.trim()
                      ? [storyLinksForm.videoUrl.trim(), ...restVideos]
                      : restVideos;
                    await editorialRepository.save(
                      {
                        kind: 'story',
                        title: c.title,
                        category: c.category,
                        excerpt: c.excerpt,
                        image: c.image,
                        imageAlt: c.imageAlt,
                        status: record.status,
                        featured: featuredIds.includes(c.id) || record.featured,
                        videos: nextVideos,
                        linkedinUrl: storyLinksForm.linkedinUrl.trim() || null,
                        storyGroups: storyLinksForm.storyGroups,
                        displayLines: {
                          line1: storyLinksForm.line1.trim(),
                          line2: storyLinksForm.line2.trim(),
                        },
                        blocks: c.blocks.length ? c.blocks : [{ type: 'paragraph', text: c.excerpt }],
                        downloads: c.downloads ?? [],
                      },
                      record.id,
                    );
                    const fresh = await editorialRepository.entries();
                    setStoryRecords(fresh.filter((e) => e.content.kind === 'story'));
                    setEditingStoryId(null);
                    setStorySaveNote(`Updated media & social links for "${c.title}".`);
                    window.dispatchEvent(new Event('yerh:editorial-updated'));
                  } catch (cause) {
                    setStorySaveError(
                      cause instanceof Error ? cause.message : 'Could not save story links.',
                    );
                  } finally {
                    setStorySaving(false);
                  }
                };

                const renderInlineEditor = (record: EditorialRecord) =>
                  editingStoryId === record.id && (
                    <div className="cms-item-card" style={{ marginTop: '0.5rem' }}>
                      <div className="cms-field-grid">
                        <label className="cms-field-label">
                          YouTube video URL
                          <input
                            type="url"
                            maxLength={500}
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={storyLinksForm.videoUrl}
                            onChange={(e) =>
                              setStoryLinksForm((cur) => ({ ...cur, videoUrl: e.target.value }))
                            }
                          />
                        </label>
                        <label className="cms-field-label">
                          LinkedIn URL
                          <input
                            type="url"
                            maxLength={500}
                            placeholder="https://www.linkedin.com/in/..."
                            value={storyLinksForm.linkedinUrl}
                            onChange={(e) =>
                              setStoryLinksForm((cur) => ({ ...cur, linkedinUrl: e.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <div className="cms-field-grid">
                        <label className="cms-field-label">
                          Homepage card line 1 (title)
                          <input
                            maxLength={120}
                            placeholder={record.content.title}
                            value={storyLinksForm.line1}
                            onChange={(e) =>
                              setStoryLinksForm((cur) => ({ ...cur, line1: e.target.value }))
                            }
                          />
                        </label>
                        <label className="cms-field-label">
                          Homepage card line 2 (subtitle)
                          <input
                            maxLength={160}
                            placeholder={record.content.excerpt}
                            value={storyLinksForm.line2}
                            onChange={(e) =>
                              setStoryLinksForm((cur) => ({ ...cur, line2: e.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <div className="cms-icon-row">
                        {(['Entrepreneur', 'Startups'] as const).map((grp) => (
                          <label key={grp} className="inline-checkbox">
                            <input
                              type="checkbox"
                              checked={storyLinksForm.storyGroups.includes(grp)}
                              onChange={(e) =>
                                setStoryLinksForm((cur) => ({
                                  ...cur,
                                  storyGroups: e.target.checked
                                    ? [...new Set([...cur.storyGroups, grp])]
                                    : cur.storyGroups.filter((g) => g !== grp),
                                }))
                              }
                            />{' '}
                            {grp} tab
                          </label>
                        ))}
                      </div>
                      <div className="cms-icon-row">
                        <button
                          type="button"
                          className="button button-small"
                          disabled={storySaving}
                          onClick={() => void saveStoryLinks(record)}
                        >
                          {storySaving ? 'Saving…' : 'Save story links'}
                        </button>
                        <button
                          type="button"
                          className="cms-icon-btn"
                          disabled={storySaving}
                          onClick={() => setEditingStoryId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );

                return (
                  <div className="cms-editor-stack">
                    <div className="cms-item-toolbar">
                      <strong style={{ fontSize: '0.88rem' }}>
                        Featured on homepage ({featuredIds.length})
                      </strong>
                    </div>
                    {featuredIds.length === 0 ? (
                      <p className="cms-helper-text">
                        No stories selected for the homepage yet. Add one below or tick &ldquo;Show
                        on front homepage under &lsquo;My Story&rsquo;&rdquo; inside Articles,
                        Stories &amp; Reports.
                      </p>
                    ) : (
                      <div className="cms-accordion-list">
                        {featuredIds.map((contentId, index) => {
                          const record = byContentId.get(contentId)!;
                          const c = record.content;
                          return (
                            <div className="cms-accordion-item" key={contentId}>
                              <div className="cms-accordion-row">
                                <div className="cms-accordion-main">
                                  <div className="cms-accordion-text">
                                    <strong>
                                      #{index + 1} · {c.title}
                                    </strong>
                                    <small>
                                      {c.videos?.[0] ? 'YouTube linked' : 'No YouTube video'} ·{' '}
                                      {c.linkedinUrl ? 'LinkedIn linked' : 'No LinkedIn'} ·{' '}
                                      {(c.storyGroups ?? []).join(', ') || 'All'}
                                    </small>
                                  </div>
                                </div>
                                <div className="cms-icon-row">
                                  <button
                                    type="button"
                                    className="cms-icon-btn"
                                    onClick={() => openStoryLinkEditor(record)}
                                  >
                                    {editingStoryId === record.id
                                      ? 'Close links'
                                      : 'Edit YouTube / LinkedIn'}
                                  </button>
                                  <button
                                    type="button"
                                    className="cms-icon-btn"
                                    aria-label={`Move ${c.title} up`}
                                    disabled={index === 0}
                                    onClick={() =>
                                      onChangeHomepage({
                                        ...homepage,
                                        featuredStories: moveItem(featuredIds, index, index - 1),
                                      })
                                    }
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cms-icon-btn"
                                    aria-label={`Move ${c.title} down`}
                                    disabled={index >= featuredIds.length - 1}
                                    onClick={() =>
                                      onChangeHomepage({
                                        ...homepage,
                                        featuredStories: moveItem(featuredIds, index, index + 1),
                                      })
                                    }
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cms-icon-btn is-danger"
                                    onClick={() =>
                                      onChangeHomepage({
                                        ...homepage,
                                        featuredStories: featuredIds.filter(
                                          (id) => id !== contentId,
                                        ),
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                              {renderInlineEditor(record)}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {availableStories.length > 0 && (
                      <>
                        <div className="cms-item-toolbar">
                          <strong style={{ fontSize: '0.88rem' }}>
                            Other published stories ({availableStories.length})
                          </strong>
                        </div>
                        <div className="cms-accordion-list">
                          {availableStories.map((record) => {
                            const c = record.content;
                            return (
                              <div className="cms-accordion-item" key={record.id}>
                                <div className="cms-accordion-row">
                                  <div className="cms-accordion-main">
                                    <div className="cms-accordion-text">
                                      <strong>{c.title}</strong>
                                      <small>
                                        {c.videos?.[0] ? 'YouTube linked' : 'No YouTube video'} ·{' '}
                                        {c.linkedinUrl ? 'LinkedIn linked' : 'No LinkedIn'}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="cms-icon-row">
                                    <button
                                      type="button"
                                      className="cms-icon-btn"
                                      onClick={() => openStoryLinkEditor(record)}
                                    >
                                      {editingStoryId === record.id
                                        ? 'Close links'
                                        : 'Edit YouTube / LinkedIn'}
                                    </button>
                                    <button
                                      type="button"
                                      className="button button-small"
                                      onClick={() =>
                                        onChangeHomepage({
                                          ...homepage,
                                          featuredStories: [...featuredIds, c.id],
                                        })
                                      }
                                    >
                                      <Plus size={13} /> Show on My Story
                                    </button>
                                  </div>
                                </div>
                                {renderInlineEditor(record)}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()
            )}
          </>
        )}

        <CardActionBar
          dirty={myStoryDirty}
          section="homepage"
          actions={cardActions}
          summaryHint="Updated My Story homepage section"
          onDiscard={
            baselineHomepage
              ? () =>
                  onChangeHomepage({
                    ...homepage,
                    myStoryTitle: baselineHomepage.myStoryTitle,
                    myStorySubtitle: baselineHomepage.myStorySubtitle,
                    featuredStories: structuredClone(baselineHomepage.featuredStories),
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${statsDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Sidebar statistics (&ldquo;Our Numbers&rdquo;)</h2>
            {!statsOpen && (
              <p className="cms-helper-text">
                {homepage.useLiveStats
                  ? `Live database counts${
                      liveStats
                        ? ` (${liveStats.mentors} mentors · ${liveStats.users} users · ${liveStats.ventures} ventures)`
                        : ''
                    }`
                  : `${homepage.statistics.length} custom stats configured`}
              </p>
            )}
          </div>
          <button
            type="button"
            className="cms-icon-btn"
            aria-expanded={statsOpen}
            onClick={() => setStatsOpen((v) => !v)}
          >
            {statsOpen ? (
              <>
                <ChevronUp size={14} /> Collapse
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Configure
              </>
            )}
          </button>
        </div>

        {statsOpen && (
          <>
            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={Boolean(homepage.useLiveStats)}
                onChange={(e) => onChangeHomepage({ ...homepage, useLiveStats: e.target.checked })}
              />{' '}
              Automatically display live YERH database counts
              {liveStats
                ? ` (${liveStats.mentors} mentors · ${liveStats.users} users · ${liveStats.ventures} ventures)`
                : ''}
            </label>

            {!homepage.useLiveStats && (
              <>
                <div className="cms-field-grid">
                  {homepage.statistics.map((stat, index) => (
                    <div className="cms-item-card" key={index}>
                      <label className="cms-field-label">
                        Label
                        <input
                          value={stat.label}
                          maxLength={40}
                          onChange={(e) =>
                            onChangeHomepage({
                              ...homepage,
                              statistics: homepage.statistics.map((s, i) =>
                                i === index ? { ...s, label: e.target.value } : s,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="cms-field-label">
                        Displayed value
                        <input
                          value={stat.value}
                          maxLength={24}
                          onChange={(e) =>
                            onChangeHomepage({
                              ...homepage,
                              statistics: homepage.statistics.map((s, i) =>
                                i === index ? { ...s, value: e.target.value } : s,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <label className="cms-field-label">
                  Footnote beneath numbers
                  <input
                    value={homepage.statisticsNote}
                    maxLength={140}
                    onChange={(e) =>
                      onChangeHomepage({ ...homepage, statisticsNote: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </>
        )}
        <CardActionBar
          dirty={statsDirty}
          section="homepage"
          actions={cardActions}
          summaryHint="Updated sidebar statistics"
          onDiscard={
            baselineHomepage
              ? () =>
                  onChangeHomepage({
                    ...homepage,
                    useLiveStats: baselineHomepage.useLiveStats,
                    statistics: structuredClone(baselineHomepage.statistics),
                    statisticsNote: baselineHomepage.statisticsNote,
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${linksDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Featured video &amp; important links ({homepage.importantLinks.length})</h2>
            {!linksOpen && (
              <p className="cms-helper-text">
                {homepage.socialVideo.title || 'No featured video'} ·{' '}
                {homepage.importantLinks.length} quick links
              </p>
            )}
          </div>
          <div className="cms-icon-row">
            {linksOpen && (
              <button
                type="button"
                className="cms-icon-btn"
                onClick={() =>
                  onChangeHomepage({
                    ...homepage,
                    importantLinks: [
                      ...homepage.importantLinks,
                      { label: 'New resource link', href: 'https://', openInNewTab: true },
                    ],
                  })
                }
              >
                <Plus size={14} /> Add link
              </button>
            )}
            <button
              type="button"
              className="cms-icon-btn"
              aria-expanded={linksOpen}
              onClick={() => setLinksOpen((v) => !v)}
            >
              {linksOpen ? (
                <>
                  <ChevronUp size={14} /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Edit
                </>
              )}
            </button>
          </div>
        </div>

        {linksOpen && (
          <>
            <div className="cms-field-grid">
              <label className="cms-field-label">
                YouTube video title
                <input
                  value={homepage.socialVideo.title}
                  maxLength={120}
                  onChange={(e) =>
                    onChangeHomepage({
                      ...homepage,
                      socialVideo: { ...homepage.socialVideo, title: e.target.value },
                    })
                  }
                />
              </label>
              <label className="cms-field-label">
                YouTube video URL
                <input
                  value={homepage.socialVideo.url}
                  maxLength={300}
                  onChange={(e) =>
                    onChangeHomepage({
                      ...homepage,
                      socialVideo: { ...homepage.socialVideo, url: e.target.value },
                    })
                  }
                />
              </label>
            </div>

            {homepage.importantLinks.map((link, index) => (
              <div className="cms-inline-link-row" key={index}>
                <label className="cms-field-label">
                  Title
                  <input
                    value={link.label}
                    maxLength={120}
                    onChange={(e) =>
                      onChangeHomepage({
                        ...homepage,
                        importantLinks: homepage.importantLinks.map((item, i) =>
                          i === index ? { ...item, label: e.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <label className="cms-field-label">
                  URL
                  <input
                    list="cms-route-presets"
                    placeholder="/opportunities or https://..."
                    value={link.href}
                    maxLength={300}
                    onChange={(e) =>
                      onChangeHomepage({
                        ...homepage,
                        importantLinks: homepage.importantLinks.map((item, i) =>
                          i === index ? { ...item, href: e.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <label className="cms-field-label">
                  Open in
                  <select
                    value={link.openInNewTab === false ? 'same' : 'new'}
                    onChange={(e) =>
                      onChangeHomepage({
                        ...homepage,
                        importantLinks: homepage.importantLinks.map((item, i) =>
                          i === index ? { ...item, openInNewTab: e.target.value !== 'same' } : item,
                        ),
                      })
                    }
                  >
                    <option value="new">New tab</option>
                    <option value="same">Same page</option>
                  </select>
                </label>
                <div className="cms-icon-row">
                  <button
                    type="button"
                    className="cms-icon-btn"
                    aria-label={`Move ${link.label} up`}
                    disabled={index === 0}
                    onClick={() =>
                      onChangeHomepage({
                        ...homepage,
                        importantLinks: moveItem(homepage.importantLinks, index, index - 1),
                      })
                    }
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="cms-icon-btn"
                    aria-label={`Move ${link.label} down`}
                    disabled={index >= homepage.importantLinks.length - 1}
                    onClick={() =>
                      onChangeHomepage({
                        ...homepage,
                        importantLinks: moveItem(homepage.importantLinks, index, index + 1),
                      })
                    }
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="cms-icon-btn is-danger"
                    aria-label={`Remove ${link.label}`}
                    onClick={() =>
                      onChangeHomepage({
                        ...homepage,
                        importantLinks: homepage.importantLinks.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        <CardActionBar
          dirty={linksDirty}
          section="homepage"
          actions={cardActions}
          summaryHint="Updated featured video and links"
          onDiscard={
            baselineHomepage
              ? () =>
                  onChangeHomepage({
                    ...homepage,
                    socialVideo: structuredClone(baselineHomepage.socialVideo),
                    importantLinks: structuredClone(baselineHomepage.importantLinks),
                  })
              : undefined
          }
        />
      </section>

      <datalist id="cms-route-presets">
        {quickRoutes.map(([path, label]) => (
          <option key={path} value={path}>
            {label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
