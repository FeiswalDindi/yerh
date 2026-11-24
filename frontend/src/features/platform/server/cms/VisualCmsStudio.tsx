import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleCheck,
  Eye,
  EyeOff,
  FilePenLine,
  Globe,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  UploadCloud,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentContext, useCatalog } from '../../../../app/useCatalog';
import type { Catalog } from '../../../../domain/content';
import { coerceNullStrings } from '../../../../domain/cms-sanitize';
import type { Faq, HomepageContent } from '../../../../domain/hub';
import {
  normalizeHomeSidebarOrder,
  type SiteContent,
  type TeamContent,
} from '../../../../domain/site';
import {
  cmsRepository,
  type CmsMediaAsset,
  type CmsSectionKey,
  type CmsWorkspaceData,
} from '../../../../services/laravel-cms-repository';
import { applyCmsDocumentsToCatalog } from '../../../../services/laravel-content-repository';
import { Footer } from '../../../../layout/Footer';
import { FeatureCarousel } from '../../../home/FeatureCarousel';
import { HomeSidebar } from '../../../home/HomeSidebar';
import { PartnerStrip } from '../../../home/PartnerStrip';
import { TeamSection } from '../../../info/TeamSection';
import { RecordsFeedback } from '../WorkspaceActions';
import { SmartImage } from '../../../../shared/SmartImage';
import { StatusIndicator } from '../../../../shared/StatusIndicator';
import type { CardActions } from './CardActionBar';
import { getDefaultManagedPage, lookupManagedPage, normalizePagePath } from './cms-page-registry';
import { FaqsEditor, PartnersEditor, TeamEditor } from './CollectionsEditors';
import { EditorialStudio } from './EditorialStudio';
import { HomepageEditor } from './HomepageEditor';
import { MediaLibraryView } from './MediaLibraryView';
import { PagesHeroEditor } from './PagesHeroEditor';
import { SiteContactEditor } from './SiteContactEditor';
import './cms-studio.css';

type StudioTab =
  | 'site'
  | 'homepage'
  | 'pages'
  | 'editorial'
  | 'faqs'
  | 'team'
  | 'partners'
  | 'media'
  | 'revisions';

const tabSectionMap: Partial<Record<StudioTab, CmsSectionKey>> = {
  site: 'site',
  pages: 'site',
  homepage: 'homepage',
  faqs: 'faqs',
  team: 'team',
  partners: 'partners',
};

const studioTabs: { id: StudioTab; label: string }[] = [
  { id: 'site', label: 'Site & Contact' },
  { id: 'homepage', label: 'Homepage' },
  { id: 'pages', label: 'Pages & Heroes' },
  { id: 'editorial', label: 'Articles, Stories & Reports' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'team', label: 'Team' },
  { id: 'partners', label: 'Partners' },
  { id: 'media', label: 'Media Library' },
  { id: 'revisions', label: 'Revisions' },
];

function hydrateDrafts(base: Catalog, workspace: CmsWorkspaceData): Record<CmsSectionKey, unknown> {
  const pick = (key: CmsSectionKey, fallback: unknown) => {
    const state = workspace.sections[key];
    return coerceNullStrings(structuredClone(state?.draft ?? state?.published ?? fallback));
  };
  const mergedSite = pick('site', base.site) as Partial<SiteContent>;
  const mergedHome = pick('homepage', base.homepage) as Partial<HomepageContent>;
  const defaultTeam: TeamContent = base.team ?? {
    title: 'Our Team',
    intro: '',
    sourceUrl: '',
    groupPhoto: { image: '', alt: '' },
    members: [],
  };

  return {
    site: {
      ...base.site,
      ...mergedSite,
      contact: { ...base.site.contact, ...(mergedSite.contact ?? {}) },
      homeSections: { ...base.site.homeSections, ...(mergedSite.homeSections ?? {}) },
      pages: { ...base.site.pages, ...(mergedSite.pages ?? {}) },
    },
    homepage: {
      ...base.homepage,
      ...mergedHome,
      socialVideo: { ...base.homepage.socialVideo, ...(mergedHome.socialVideo ?? {}) },
    },
    faqs: pick('faqs', base.faqs),
    team: {
      ...defaultTeam,
      ...(pick('team', defaultTeam) as Partial<TeamContent>),
    },
    partners: pick('partners', base.media.partners),
  };
}

function cloneSections(docs: Record<CmsSectionKey, unknown>): Record<CmsSectionKey, unknown> {
  return {
    site: structuredClone(docs.site),
    homepage: structuredClone(docs.homepage),
    faqs: structuredClone(docs.faqs),
    team: structuredClone(docs.team),
    partners: structuredClone(docs.partners),
  };
}

export function VisualCmsStudio() {
  const baseCatalog = useCatalog();
  const [workspace, setWorkspace] = useState<CmsWorkspaceData | null>(null);
  const [media, setMedia] = useState<CmsMediaAsset[]>([]);
  const [drafts, setDrafts] = useState<Record<CmsSectionKey, unknown> | null>(null);
  const [baselineDocs, setBaselineDocs] = useState<Record<CmsSectionKey, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('homepage');
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedPagePath, setSelectedPagePath] = useState('/about');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(false);
  const [revSection, setRevSection] = useState<'all' | CmsSectionKey>('all');
  const [revSearch, setRevSearch] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadWorkspace = useCallback(async () => {
    setError('');
    try {
      const [ws, assets] = await Promise.all([cmsRepository.workspace(), cmsRepository.media()]);
      setWorkspace(ws);
      setMedia(assets);
      const hydrated = hydrateDrafts(baseCatalog, ws);
      setDrafts(hydrated);
      setBaselineDocs(cloneSections(hydrated));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Content Studio.');
    }
  }, [baseCatalog]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const activeSection = tabSectionMap[activeTab];

  const isSectionDirty = useCallback(
    (section: CmsSectionKey) =>
      Boolean(
        drafts &&
        baselineDocs &&
        JSON.stringify(drafts[section]) !== JSON.stringify(baselineDocs[section]),
      ),
    [drafts, baselineDocs],
  );

  const previewCatalog = useMemo(() => {
    if (!drafts) return baseCatalog;
    return applyCmsDocumentsToCatalog(baseCatalog, drafts, workspace?.liveStats ?? null);
  }, [baseCatalog, drafts, workspace?.liveStats]);

  function updateSection(section: CmsSectionKey, value: unknown) {
    setDrafts((current) => (current ? { ...current, [section]: value } : current));
    setNotice('');
  }

  async function saveSections(sections: CmsSectionKey[]) {
    if (!drafts || sections.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      for (const section of sections) {
        await cmsRepository.saveDraft(section, drafts[section]);
      }
      setBaselineDocs((current) => {
        if (!current) return current;
        const copy = { ...current };
        for (const section of sections) {
          copy[section] = structuredClone(drafts[section]);
        }
        return copy;
      });
      const ws = await cmsRepository.workspace();
      setWorkspace(ws);
      setNotice('Draft saved. The live public site is unchanged until you click Publish live.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save draft.');
    } finally {
      setBusy(false);
    }
  }

  async function publishSections(sections: CmsSectionKey[], summaryOverride?: string) {
    if (!drafts || sections.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const note = summaryOverride?.trim() || summary.trim() || undefined;
      const publishedResults: { section: CmsSectionKey; version: number }[] = [];
      for (const section of sections) {
        const result = await cmsRepository.publish(section, drafts[section], note);
        publishedResults.push(result);
      }
      if (!summaryOverride) setSummary('');
      setBaselineDocs((current) => {
        if (!current) return current;
        const copy = { ...current };
        for (const section of sections) {
          copy[section] = structuredClone(drafts[section]);
        }
        return copy;
      });
      const ws = await cmsRepository.workspace();
      setWorkspace(ws);
      setNotice(
        `Published ${publishedResults.map((r) => `${r.section} v${r.version}`).join(' & ')} live to the website.`,
      );
      window.dispatchEvent(new Event('yerh:editorial-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish changes.');
    } finally {
      setBusy(false);
    }
  }

  if (!workspace || !drafts || !baselineDocs) {
    return <RecordsFeedback loading={!error} error={error} />;
  }

  const siteDraft = drafts.site as SiteContent;
  const siteBaseline = baselineDocs.site as SiteContent;
  const homeDraft = drafts.homepage as HomepageContent;
  const homeBaseline = baselineDocs.homepage as HomepageContent;
  const faqsDraft = drafts.faqs as Faq[];
  const faqsBaseline = baselineDocs.faqs as Faq[];
  const teamDraft = drafts.team as TeamContent;
  const teamBaseline = baselineDocs.team as TeamContent;
  const partnersDraft = drafts.partners as Catalog['media']['partners'];
  const partnersBaseline = baselineDocs.partners as Catalog['media']['partners'];

  const publishedSiteDoc = workspace.sections.site?.published as Partial<SiteContent> | null;
  const publishedHomeSections = {
    ...baseCatalog.site.homeSections,
    ...(publishedSiteDoc?.homeSections ?? {}),
  };
  const publishedSidebarOrder = normalizeHomeSidebarOrder(
    publishedSiteDoc?.homeSidebarOrder ?? baseCatalog.site.homeSidebarOrder,
  );
  const isHomeSectionsDirty =
    JSON.stringify(siteDraft.homeSections) !== JSON.stringify(siteBaseline.homeSections) ||
    JSON.stringify(normalizeHomeSidebarOrder(siteDraft.homeSidebarOrder)) !==
      JSON.stringify(normalizeHomeSidebarOrder(siteBaseline.homeSidebarOrder));
  const homeSectionsServerDraft = Boolean(
    workspace.sections.site?.has_draft &&
    (JSON.stringify(siteDraft.homeSections) !== JSON.stringify(publishedHomeSections) ||
      JSON.stringify(normalizeHomeSidebarOrder(siteDraft.homeSidebarOrder)) !==
        JSON.stringify(publishedSidebarOrder)),
  );

  const homepageTabDirty = isSectionDirty('homepage') || isHomeSectionsDirty;
  const homepageTabServerDraft = Boolean(
    workspace.sections.homepage?.has_draft || homeSectionsServerDraft,
  );

  const sectionState = activeSection ? workspace.sections[activeSection] : null;
  const isDirty =
    activeTab === 'homepage'
      ? homepageTabDirty
      : activeSection
        ? isSectionDirty(activeSection)
        : false;
  const hasServerDraft =
    activeTab === 'homepage' ? homepageTabServerDraft : Boolean(sectionState?.has_draft);
  const hasPendingActions = Boolean(activeSection && (isDirty || hasServerDraft));

  function homepageTargetSections(): CmsSectionKey[] {
    const out: CmsSectionKey[] = [];
    if (isSectionDirty('homepage') || workspace?.sections.homepage?.has_draft) {
      out.push('homepage');
    }
    if (isHomeSectionsDirty || homeSectionsServerDraft) {
      out.push('site');
    }
    return out.length ? out : ['homepage'];
  }

  async function saveTopBarDraft() {
    if (!activeSection) return;
    const targets =
      activeTab === 'homepage'
        ? ([
            ...(isSectionDirty('homepage') ? (['homepage'] as const) : []),
            ...(isHomeSectionsDirty ? (['site'] as const) : []),
          ] as CmsSectionKey[])
        : [activeSection];
    await saveSections(targets.length ? targets : [activeSection]);
  }

  async function publishTopBar() {
    if (!activeSection) return;
    const targets = activeTab === 'homepage' ? homepageTargetSections() : [activeSection];
    await publishSections(targets);
  }

  async function discardTopBar() {
    if (!activeSection || !baselineDocs || !workspace) return;
    if (activeTab === 'homepage') {
      const homeHasServer = Boolean(workspace.sections.homepage?.has_draft);
      if (!homeHasServer && !homeSectionsServerDraft) {
        if (!window.confirm('Discard your unsaved Homepage changes?')) return;
        setDrafts((current) =>
          current
            ? {
                ...current,
                homepage: structuredClone(homeBaseline),
                site: {
                  ...siteDraft,
                  homeSections: structuredClone(siteBaseline.homeSections),
                  homeSidebarOrder: normalizeHomeSidebarOrder(siteBaseline.homeSidebarOrder),
                },
              }
            : current,
        );
        setNotice('Unsaved changes discarded.');
        return;
      }
      if (!window.confirm('Discard saved Homepage drafts and revert to the published version?')) {
        return;
      }
      setBusy(true);
      setError('');
      try {
        if (homeHasServer) await cmsRepository.discardDraft('homepage');
        if (homeSectionsServerDraft && !isSectionDirty('site')) {
          await cmsRepository.discardDraft('site');
        } else if (homeSectionsServerDraft) {
          setDrafts((current) =>
            current
              ? {
                  ...current,
                  site: {
                    ...siteDraft,
                    homeSections: structuredClone(publishedHomeSections),
                    homeSidebarOrder: publishedSidebarOrder,
                  },
                }
              : current,
          );
        }
        await loadWorkspace();
        setNotice('Homepage draft discarded.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not discard draft.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const sectionServerDraft = Boolean(workspace.sections[activeSection]?.has_draft);
    if (!sectionServerDraft) {
      if (!window.confirm('Discard your unsaved edits in this section?')) return;
      const reverted = structuredClone(baselineDocs[activeSection]);
      setDrafts((current) => (current ? { ...current, [activeSection]: reverted } : current));
      setNotice('Unsaved changes discarded.');
      return;
    }
    if (!window.confirm('Discard your draft and revert this section to the published version?')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await cmsRepository.discardDraft(activeSection);
      await loadWorkspace();
      setNotice('Draft discarded.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not discard draft.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision(id: number) {
    setBusy(true);
    setError('');
    try {
      const result = await cmsRepository.restoreRevision(id);
      await loadWorkspace();
      setNotice(`Restored ${result.section} as v${result.version} and published live.`);
      window.dispatchEvent(new Event('yerh:editorial-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore revision.');
    } finally {
      setBusy(false);
    }
  }

  const cardActions: CardActions = {
    busy,
    sectionHasDraft: (section) => Boolean(workspace.sections[section]?.has_draft),
    onSaveDraft: (section) => saveSections([section]),
    onPublish: (section, defaultSummary) =>
      publishSections([section], summary.trim() || defaultSummary),
  };

  const normalizedSelectedPagePath = normalizePagePath(selectedPagePath);
  const previewPage =
    lookupManagedPage(previewCatalog.site.pages, normalizedSelectedPagePath) ??
    getDefaultManagedPage(normalizedSelectedPagePath);

  const normalizedRevQuery = revSearch.trim().toLowerCase();
  const filteredRevisions = workspace.revisions.filter((rev) => {
    if (revSection !== 'all' && rev.section !== revSection) return false;
    if (!normalizedRevQuery) return true;
    return [rev.section, rev.summary ?? '', rev.author ?? '', `v${rev.version}`]
      .join(' ')
      .toLowerCase()
      .includes(normalizedRevQuery);
  });

  return (
    <section className="cms-studio" aria-label="YERH Visual Content Studio">
      <div className="cms-studio-bar">
        <div className="cms-studio-meta">
          {sectionState && (
            <>
              <StatusIndicator
                status="published"
                label={
                  sectionState.published_version > 0
                    ? `Published v${sectionState.published_version}`
                    : 'Live (default)'
                }
              />
              {(hasServerDraft || isDirty) && (
                <StatusIndicator
                  status={isDirty ? 'unsaved edits' : 'saved draft'}
                  label={isDirty ? 'Unsaved edits' : 'Saved draft'}
                />
              )}
              {sectionState.published_author && <span>By {sectionState.published_author}</span>}
            </>
          )}
        </div>

        <div className="cms-studio-actions">
          {activeTab !== 'media' && activeTab !== 'revisions' && (
            <button
              type="button"
              className="cms-icon-btn"
              aria-pressed={showPreview}
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          )}
          <Link className="cms-icon-btn" to="/" target="_blank">
            View site <Globe size={14} />
          </Link>
        </div>
      </div>

      <nav className="cms-studio-nav" role="tablist" aria-label="Content Studio sections">
        {studioTabs.map((tab) => {
          const mapped = tabSectionMap[tab.id];
          const hasPending =
            tab.id === 'homepage'
              ? homepageTabDirty || homepageTabServerDraft
              : Boolean(
                  mapped && (isSectionDirty(mapped) || workspace.sections[mapped]?.has_draft),
                );
          const isLivePublished = Boolean(
            mapped && !hasPending && (workspace.sections[mapped]?.published_version ?? 0) > 0,
          );
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              title={
                hasPending ? 'Unpublished draft' : isLivePublished ? 'Published live' : undefined
              }
              onClick={() => {
                setActiveTab(tab.id);
                setError('');
                setNotice('');
              }}
            >
              {tab.label}
              {hasPending && (
                <>
                  <FilePenLine
                    size={13}
                    className="cms-tab-status-icon is-warning"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (Unpublished draft)</span>
                </>
              )}
              {isLivePublished && (
                <>
                  <CircleCheck
                    size={13}
                    className="cms-tab-status-icon is-success"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (Published live)</span>
                </>
              )}
            </button>
          );
        })}
      </nav>

      {activeSection && (hasPendingActions || error || notice) && (
        <div className="cms-studio-banner">
          {hasPendingActions && (
            <div className="cms-item-toolbar">
              <div className="cms-publish-note">
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Optional change note…"
                  maxLength={180}
                />
              </div>
              <div className="cms-icon-row">
                <button
                  type="button"
                  className="cms-icon-btn is-danger"
                  disabled={busy}
                  onClick={() => void discardTopBar()}
                >
                  <RotateCcw size={13} />{' '}
                  {isDirty && !hasServerDraft ? 'Discard changes' : 'Discard draft'}
                </button>
                {isDirty && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={busy}
                    onClick={() => void saveTopBarDraft()}
                  >
                    <Save size={14} /> Save draft
                  </button>
                )}
                <button
                  type="button"
                  className="button button-small"
                  disabled={busy}
                  onClick={() => void publishTopBar()}
                >
                  <UploadCloud size={14} /> {busy ? 'Publishing…' : 'Publish live'}
                </button>
              </div>
            </div>
          )}
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
        </div>
      )}

      {activeTab === 'editorial' ? (
        <EditorialStudio
          media={media}
          onUploaded={(asset) => setMedia((prev) => [asset, ...prev])}
          showPreview={showPreview}
          viewport={viewport}
        />
      ) : activeTab === 'media' ? (
        <MediaLibraryView
          media={media}
          onUploaded={(asset) => setMedia((prev) => [asset, ...prev])}
          onDeleted={(id) => setMedia((prev) => prev.filter((item) => item.id !== id))}
          onUpdated={(id, patch) =>
            setMedia((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
          }
        />
      ) : activeTab === 'revisions' ? (
        <section className="cms-card">
          <div className="cms-card-header">
            <h2>Published revisions ({filteredRevisions.length})</h2>
          </div>

          <div className="cms-filter-bar">
            <select
              aria-label="Filter revisions by section"
              value={revSection}
              onChange={(e) => setRevSection(e.target.value as 'all' | CmsSectionKey)}
            >
              <option value="all">All sections</option>
              <option value="site">Site &amp; Pages</option>
              <option value="homepage">Homepage</option>
              <option value="faqs">FAQs</option>
              <option value="team">Team</option>
              <option value="partners">Partners</option>
            </select>
            <input
              type="search"
              placeholder="Search note, version, or author…"
              value={revSearch}
              onChange={(e) => setRevSearch(e.target.value)}
            />
          </div>

          {filteredRevisions.length === 0 ? (
            <p className="cms-helper-text">No matching revisions recorded.</p>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Section</th>
                    <th>Summary</th>
                    <th>Published by</th>
                    <th>Date (EAT)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRevisions.map((rev) => (
                    <tr key={rev.id}>
                      <td>
                        <StatusIndicator status="published" label={`v${rev.version}`} size={14} />
                      </td>
                      <td>
                        <strong>{rev.section.toUpperCase()}</strong>
                      </td>
                      <td>{rev.summary || 'Published update'}</td>
                      <td>{rev.author ?? 'Editor'}</td>
                      <td>{new Date(rev.created_at).toLocaleString('en-KE')}</td>
                      <td>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          disabled={busy}
                          onClick={() => void restoreRevision(rev.id)}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className={`cms-studio-split${showPreview ? '' : ' is-preview-hidden'}`}>
          <div>
            {activeTab === 'site' && (
              <SiteContactEditor
                site={siteDraft}
                baselineSite={siteBaseline}
                onChange={(next) => updateSection('site', next)}
                cardActions={cardActions}
              />
            )}
            {activeTab === 'homepage' && (
              <HomepageEditor
                homepage={homeDraft}
                site={siteDraft}
                baselineHomepage={homeBaseline}
                baselineSite={siteBaseline}
                liveStats={workspace.liveStats}
                selectedSlide={selectedSlide}
                onSelectSlide={setSelectedSlide}
                onChangeHomepage={(next) => updateSection('homepage', next)}
                onChangeSite={(next) => updateSection('site', next)}
                media={media}
                onUploaded={(asset) => setMedia((prev) => [asset, ...prev])}
                cardActions={cardActions}
              />
            )}
            {activeTab === 'pages' && (
              <PagesHeroEditor
                site={siteDraft}
                baselineSite={siteBaseline}
                selectedPath={selectedPagePath}
                onSelectPath={setSelectedPagePath}
                onChange={(next) => updateSection('site', next)}
                media={media}
                onUploaded={(asset) => setMedia((prev) => [asset, ...prev])}
                cardActions={cardActions}
              />
            )}
            {activeTab === 'faqs' && (
              <FaqsEditor
                faqs={faqsDraft}
                baselineFaqs={faqsBaseline}
                onChange={(next) => updateSection('faqs', next)}
                cardActions={cardActions}
              />
            )}
            {activeTab === 'team' && (
              <TeamEditor
                team={teamDraft}
                baselineTeam={teamBaseline}
                onChange={(next) => updateSection('team', next)}
                media={media}
                onUploaded={(asset) => setMedia((prev) => [asset, ...prev])}
                cardActions={cardActions}
              />
            )}
            {activeTab === 'partners' && (
              <PartnersEditor
                partners={partnersDraft}
                baselinePartners={partnersBaseline}
                onChange={(next) => updateSection('partners', next)}
                media={media}
                onUploaded={(asset) => setMedia((prev) => [asset, ...prev])}
                cardActions={cardActions}
              />
            )}
          </div>

          {showPreview && (
            <aside className="cms-preview-pane" aria-label="Live visual preview">
              <div className="cms-preview-bar">
                <strong>Live preview</strong>
                <div className="cms-viewport-tabs" role="group" aria-label="Preview viewport">
                  <button
                    type="button"
                    aria-pressed={viewport === 'desktop'}
                    title="Desktop preview"
                    onClick={() => setViewport('desktop')}
                  >
                    <Monitor size={13} /> Desktop
                  </button>
                  <button
                    type="button"
                    aria-pressed={viewport === 'tablet'}
                    title="Tablet preview"
                    onClick={() => setViewport('tablet')}
                  >
                    <Tablet size={13} /> Tablet
                  </button>
                  <button
                    type="button"
                    aria-pressed={viewport === 'mobile'}
                    title="Mobile preview"
                    onClick={() => setViewport('mobile')}
                  >
                    <Smartphone size={13} /> Mobile
                  </button>
                </div>
              </div>
              <div className="cms-preview-canvas">
                <div className="cms-preview-frame" data-viewport={viewport}>
                  <ContentContext.Provider value={previewCatalog}>
                    {activeTab === 'site' && (
                      <div className="cms-preview-block">
                        {previewCatalog.site.announcement?.enabled &&
                          previewCatalog.site.announcement?.text?.trim() && (
                            <div
                              className="site-announcement-bar"
                              style={{ borderRadius: '0.45rem' }}
                            >
                              <div className="site-announcement-inner">
                                <span>{previewCatalog.site.announcement.text}</span>
                                {previewCatalog.site.announcement.linkLabel && (
                                  <a href="#preview">
                                    {previewCatalog.site.announcement.linkLabel}
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        <div className="profile-panel">
                          <span className="eyebrow">Contact details preview</span>
                          <h3>{previewCatalog.site.name}</h3>
                          <p>{previewCatalog.site.slogan}</p>
                          <p>
                            <strong>Email:</strong> {previewCatalog.site.contact.email} ·{' '}
                            <strong>Phone:</strong> {previewCatalog.site.contact.phone} ·{' '}
                            <strong>WhatsApp:</strong> {previewCatalog.site.contact.whatsapp} ·{' '}
                            <strong>Location:</strong> {previewCatalog.site.contact.address}
                          </p>
                        </div>
                        <Footer />
                      </div>
                    )}

                    {activeTab === 'homepage' && (
                      <div className="cms-preview-block">
                        <FeatureCarousel previewSlideIndex={selectedSlide} />
                        <div className="profile-panel">
                          <span className="eyebrow">Visible sections</span>
                          <p>
                            Stories:{' '}
                            {previewCatalog.site.homeSections.stories !== false ? 'On' : 'Off'} ·
                            Businesses:{' '}
                            {previewCatalog.site.homeSections.businesses !== false ? 'On' : 'Off'} ·
                            Events:{' '}
                            {previewCatalog.site.homeSections.events !== false ? 'On' : 'Off'} ·
                            Updates:{' '}
                            {previewCatalog.site.homeSections.updates !== false ? 'On' : 'Off'} ·
                            Sidebar News:{' '}
                            {previewCatalog.site.homeSections.blogs !== false ? 'On' : 'Off'} ·
                            Partners:{' '}
                            {previewCatalog.site.homeSections.partners !== false ? 'On' : 'Off'}
                          </p>
                        </div>
                        <div className="profile-panel">
                          <span className="eyebrow">Homepage sidebar order preview</span>
                          <HomeSidebar />
                        </div>
                        {previewCatalog.site.homeSections.partners !== false && <PartnerStrip />}
                      </div>
                    )}

                    {activeTab === 'pages' && (
                      <div className="cms-preview-block">
                        <header
                          className={[
                            'page-intro',
                            previewPage?.heroImage?.trim()
                              ? `has-hero-image hero-overlay-${previewPage.heroOverlay ?? 'navy'}`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{ borderRadius: '0.6rem' }}
                        >
                          {previewPage?.heroImage?.trim() && (
                            <div className="page-intro-media" aria-hidden="true">
                              <SmartImage
                                src={previewPage.heroImage}
                                alt={previewPage.heroImageAlt || ''}
                                priority
                                targetWidth={1200}
                              />
                              <div className="page-intro-scrim" />
                            </div>
                          )}
                          <div className="container">
                            <span className="eyebrow">{previewPage?.eyebrow || 'YERH'}</span>
                            <h1>{previewPage?.title || 'Page heading'}</h1>
                            <p className="intro-description">{previewPage?.description || ''}</p>
                          </div>
                        </header>
                        {previewPage?.sections.map((sec, idx) => (
                          <article className="profile-panel" key={idx}>
                            <h2>{sec.title}</h2>
                            <p style={{ whiteSpace: 'pre-line' }}>{sec.body}</p>
                          </article>
                        ))}
                      </div>
                    )}

                    {activeTab === 'faqs' && (
                      <div className="cms-preview-block">
                        <div className="faq-list faq-full">
                          {faqsDraft.map((faq, idx) => (
                            <details open={idx === 0} key={idx}>
                              <summary>
                                {faq.question} <span>+</span>
                              </summary>
                              <p>{faq.answer}</p>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'team' && (
                      <div className="cms-preview-block">
                        <TeamSection team={teamDraft} />
                      </div>
                    )}

                    {activeTab === 'partners' && (
                      <div className="cms-preview-block">
                        <PartnerStrip />
                      </div>
                    )}
                  </ContentContext.Provider>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
