import { mediaAssets } from '../config/media';
import type { Catalog } from '../domain/content';
import { coerceNullStrings } from '../domain/cms-sanitize';
import type { EntrepreneurshipTopic, Faq, HomepageContent, Lesson } from '../domain/hub';
import type { TermsDocument } from '../domain/legal';
import type { SidebarData } from '../domain/sidebar';
import { normalizeHomeSidebarOrder, type SiteContent, type TeamContent } from '../domain/site';
import type { ContentRepository } from './content-repository';
import {
  cmsRepository,
  type CmsLiveStats,
  type CmsPublicSectionKey,
} from './laravel-cms-repository';
import { editorialRepository } from './laravel-editorial-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const EMPTY_CATALOG: Catalog = {
  site: {
    name: 'Youth Entrepreneurship Resource Hub',
    slogan: 'Empower young people to become entrepreneurs',
    contact: {
      email: 'yerhdev@gmail.com',
      phone: '+254768980297',
      whatsapp: '+254768980297',
      address: 'Nairobi, Kenya',
    },
    socials: [],
    navigation: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        children: [
          { id: 'about', label: 'About Us', href: '/about' },
          { id: 'faq', label: 'FAQ', href: '/faq' },
        ],
      },
      {
        id: 'resources',
        label: 'Resources',
        href: '/resources',
        children: [
          { id: 'marketplace', label: 'Shop', href: '/marketplace' },
          { id: 'forums', label: 'Forums', href: '/forums' },
          { id: 'groups', label: 'Groups', href: '/groups' },
          { id: 'learn', label: 'Courses', href: '/learn' },
        ],
      },
      {
        id: 'benefits',
        label: 'Benefits',
        href: '/opportunities',
        children: [
          { id: 'opportunities', label: 'Opportunities', href: '/opportunities' },
          { id: 'events-benefits', label: 'Events', href: '/events' },
        ],
      },
      {
        id: 'publications',
        label: 'Publications',
        href: '/publications',
        children: [
          { id: 'stories', label: 'Success Stories', href: '/publications/stories' },
          { id: 'blogs', label: 'Blogs', href: '/publications/blogs' },
          { id: 'reports', label: 'Reports & Briefs', href: '/publications/reports' },
        ],
      },
      {
        id: 'careers',
        label: 'Careers',
        href: '/careers',
        children: [
          {
            id: 'careers-institutions',
            label: 'Register Your Institution',
            href: '/careers/institutions',
          },
          { id: 'careers-partnerships', label: 'Partnerships', href: '/careers/partnerships' },
          { id: 'careers-mentorship', label: 'Mentorship', href: '/careers/mentorship' },
          { id: 'careers-invest', label: 'Invest with Us', href: '/careers/invest' },
        ],
      },
      { id: 'contact', label: 'Contact Us', href: '/contact' },
    ],
    pages: {},
    homeSections: {
      stories: true,
      businesses: true,
      events: true,
      blogs: true,
      updates: true,
      partners: true,
      links: true,
      statistics: true,
      socials: true,
    },
    homeSidebarOrder: ['news', 'links', 'partners', 'statistics', 'socials'],
  },
  sidebar: {
    featuredIds: [],
    featuredCourseIds: [],
    popularity: [],
    popularitySource: 'Live reader likes on YERH.',
    comments: [],
    advertisements: [],
  },
  terms: {
    title: 'Terms of service',
    effectiveDate: '2026-08-19',
    intro: '',
    summary: [],
    sections: [],
    contactEmail: 'yerhdev@gmail.com',
    source: '',
  },
  items: [],
  lessons: [],
  courses: [],
  topics: [],
  faqs: [],
  homepage: {
    featuredStories: [],
    featuredBusinesses: [],
    featuredBlogs: [],
    featuredGuides: [],
    slides: [],
    importantLinks: [],
    statistics: [],
    statisticsNote: '',
    socialVideo: { url: '', title: '' },
  },
  media: { ...mediaAssets, partners: [] },
};

export function applyCmsDocumentsToCatalog(
  base: Catalog,
  documents: Partial<Record<CmsPublicSectionKey, unknown>>,
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
      navigation:
        Array.isArray(incoming.navigation) && incoming.navigation.length > 0
          ? incoming.navigation
          : base.site.navigation,
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

  let terms: TermsDocument = base.terms;
  if (isRecord(safeDocuments.terms)) {
    const incoming = safeDocuments.terms as Partial<TermsDocument>;
    terms = {
      ...base.terms,
      ...incoming,
      summary: Array.isArray(incoming.summary) ? incoming.summary : base.terms.summary,
      sections: Array.isArray(incoming.sections) ? incoming.sections : base.terms.sections,
    };
  }

  const topics: EntrepreneurshipTopic[] = Array.isArray(safeDocuments.entrepreneurship)
    ? (safeDocuments.entrepreneurship as EntrepreneurshipTopic[])
    : base.topics;

  const lessons: Lesson[] = Array.isArray(safeDocuments.lessons)
    ? (safeDocuments.lessons as Lesson[])
    : base.lessons;

  let sidebar: SidebarData = base.sidebar;
  if (isRecord(safeDocuments.sidebar)) {
    const incoming = safeDocuments.sidebar as Partial<SidebarData>;
    sidebar = {
      ...base.sidebar,
      ...incoming,
      featuredIds: Array.isArray(incoming.featuredIds)
        ? incoming.featuredIds
        : base.sidebar.featuredIds,
      featuredCourseIds: Array.isArray(incoming.featuredCourseIds)
        ? incoming.featuredCourseIds
        : base.sidebar.featuredCourseIds,
      popularity: Array.isArray(incoming.popularity)
        ? incoming.popularity
        : base.sidebar.popularity,
      comments: Array.isArray(incoming.comments) ? incoming.comments : base.sidebar.comments,
      advertisements: Array.isArray(incoming.advertisements)
        ? incoming.advertisements
        : base.sidebar.advertisements,
    };
  }

  return {
    ...base,
    site,
    homepage,
    faqs,
    team,
    terms,
    topics,
    lessons,
    sidebar,
    media: {
      ...base.media,
      partners,
    },
  };
}

export const laravelContentRepository: ContentRepository = {
  async loadCatalog(signal) {
    const [feed, cms] = await Promise.all([
      editorialRepository.publicFeed(signal),
      cmsRepository.publicPayload(signal),
    ]);

    const merged = applyCmsDocumentsToCatalog(EMPTY_CATALOG, cms.documents, cms.liveStats);
    const items = feed.items;
    const itemIds = new Set(items.map((item) => item.id));

    return {
      ...merged,
      items,
      homepage: {
        ...merged.homepage,
        featuredStories: [
          ...new Set([
            ...merged.homepage.featuredStories.filter((id) => itemIds.has(id)),
            ...feed.featured.filter((id) => itemIds.has(id)),
          ]),
        ],
      },
    };
  },
};
