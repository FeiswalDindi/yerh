import type { Catalog } from '../domain/content';
import { coerceNullStrings } from '../domain/cms-sanitize';
import type { HomepageContent, Faq } from '../domain/hub';
import { normalizeHomeSidebarOrder, type SiteContent, type TeamContent } from '../domain/site';
import { localContentRepository, type ContentRepository } from './content-repository';
import { cmsRepository, type CmsLiveStats, type CmsSectionKey } from './laravel-cms-repository';
import { editorialRepository } from './laravel-editorial-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function applyCmsDocumentsToCatalog(
  base: Catalog,
  documents: Partial<Record<CmsSectionKey, unknown>>,
  liveStats?: CmsLiveStats | null,
): Catalog {
  const safeDocuments = coerceNullStrings(documents);
  let site: SiteContent = base.site;
  if (isRecord(safeDocuments.site)) {
    const incoming = safeDocuments.site as Partial<SiteContent>;
    site = {
      ...base.site,
      ...incoming,
      contact: { ...base.site.contact, ...(isRecord(incoming.contact) ? incoming.contact : {}) },
      homeSections: {
        ...base.site.homeSections,
        ...(isRecord(incoming.homeSections) ? incoming.homeSections : {}),
      },
      pages: { ...base.site.pages, ...(isRecord(incoming.pages) ? incoming.pages : {}) },
      socials: Array.isArray(incoming.socials) ? incoming.socials : base.site.socials,
      navigation: base.site.navigation,
      homeSidebarOrder: normalizeHomeSidebarOrder(
        incoming.homeSidebarOrder ?? base.site.homeSidebarOrder,
      ),
      footerCta: isRecord(incoming.footerCta)
        ? (incoming.footerCta as SiteContent['footerCta'])
        : base.site.footerCta,
      announcement: isRecord(incoming.announcement)
        ? (incoming.announcement as SiteContent['announcement'])
        : base.site.announcement,
    };
  }

  let homepage: HomepageContent = base.homepage;
  if (isRecord(safeDocuments.homepage)) {
    const incoming = safeDocuments.homepage as Partial<HomepageContent>;
    homepage = {
      ...base.homepage,
      ...incoming,
      slides: Array.isArray(incoming.slides) ? incoming.slides : base.homepage.slides,
      statistics: Array.isArray(incoming.statistics)
        ? incoming.statistics
        : base.homepage.statistics,
      importantLinks: Array.isArray(incoming.importantLinks)
        ? incoming.importantLinks
        : base.homepage.importantLinks,
      socialVideo: isRecord(incoming.socialVideo)
        ? (incoming.socialVideo as HomepageContent['socialVideo'])
        : base.homepage.socialVideo,
    };
  }

  if (homepage.useLiveStats && liveStats) {
    homepage = {
      ...homepage,
      statistics: [
        { label: 'Mentors', value: liveStats.mentors.toLocaleString('en-KE'), tone: 'mentors' },
        {
          label: 'Registered Users',
          value: liveStats.users.toLocaleString('en-KE'),
          tone: 'visits',
        },
        {
          label: 'Approved Ventures',
          value: liveStats.ventures.toLocaleString('en-KE'),
          tone: 'users',
        },
      ],
      statisticsNote: 'Live YERH platform counts.',
    };
  }

  const faqs: Faq[] = Array.isArray(safeDocuments.faqs) ? (safeDocuments.faqs as Faq[]) : base.faqs;

  let team: TeamContent | undefined = base.team;
  if (isRecord(safeDocuments.team)) {
    const incoming = safeDocuments.team as Partial<TeamContent>;
    team = {
      title: incoming.title ?? base.team?.title ?? 'Our Team',
      intro: incoming.intro ?? base.team?.intro ?? '',
      sourceUrl: '',
      groupPhoto: isRecord(incoming.groupPhoto)
        ? (incoming.groupPhoto as TeamContent['groupPhoto'])
        : (base.team?.groupPhoto ?? { image: '', alt: '' }),
      members: Array.isArray(incoming.members) ? incoming.members : (base.team?.members ?? []),
    };
  }

  const partners = Array.isArray(safeDocuments.partners)
    ? (safeDocuments.partners as Catalog['media']['partners'])
    : base.media.partners;

  return {
    ...base,
    site,
    homepage,
    faqs,
    team,
    media: {
      ...base.media,
      partners,
    },
  };
}

export const laravelContentRepository: ContentRepository = {
  async loadCatalog(signal) {
    const [base, feed, cms] = await Promise.all([
      localContentRepository.loadCatalog(signal),
      editorialRepository.publicFeed(signal),
      cmsRepository
        .publicPayload(signal)
        .catch((): { documents: {}; liveStats: null } => ({ documents: {}, liveStats: null })),
    ]);

    const merged = applyCmsDocumentsToCatalog(base, cms.documents, cms.liveStats);
    const items = new Map(merged.items.map((item) => [item.id, item]));
    feed.hidden.forEach((id) => items.delete(id));
    feed.items.forEach((item) => items.set(item.id, item));

    return {
      ...merged,
      items: [...items.values()],
      homepage: {
        ...merged.homepage,
        featuredStories: [
          ...new Set([
            ...feed.featured,
            ...merged.homepage.featuredStories.filter((id) => items.has(id)),
          ]),
        ],
      },
    };
  },
};
