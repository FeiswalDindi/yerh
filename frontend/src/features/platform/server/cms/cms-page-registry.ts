import type { ManagedPage } from '../../../../domain/site';

export type PageCategoryId =
  | 'all'
  | 'customized'
  | 'core'
  | 'careers'
  | 'resources'
  | 'publications'
  | 'benefits'
  | 'community'
  | 'legal'
  | 'custom';

export interface SystemPageEntry {
  path: string;
  label: string;
  category: Exclude<PageCategoryId, 'all' | 'customized' | 'custom'>;
  defaultPage: ManagedPage;
}

export const PAGE_CATEGORIES: { id: PageCategoryId; label: string }[] = [
  { id: 'all', label: 'All pages' },
  { id: 'customized', label: 'Customized' },
  { id: 'core', label: 'Core & Info' },
  { id: 'careers', label: 'Careers & Partnerships' },
  { id: 'resources', label: 'Resources & Learning' },
  { id: 'publications', label: 'Publications' },
  { id: 'benefits', label: 'Benefits & Directory' },
  { id: 'community', label: 'Community & Mentorship' },
  { id: 'legal', label: 'Legal & Policies' },
  { id: 'custom', label: 'Custom & Added' },
];

export const SYSTEM_PAGE_REGISTRY: SystemPageEntry[] = [
  {
    path: '/about',
    label: 'About Us',
    category: 'core',
    defaultPage: {
      eyebrow: 'About the hub',
      title: 'Turning entrepreneurial learning into action.',
      description:
        'A shared ambition: to help young people build sustainable, thriving enterprises.',
      sections: [],
    },
  },
  {
    path: '/contact',
    label: 'Contact Us',
    category: 'core',
    defaultPage: {
      eyebrow: 'Contact us',
      title: 'Good conversations open new doors.',
      description: 'Have a question, an idea, or a story to share? We’d love to hear from you.',
      sections: [],
    },
  },
  {
    path: '/faq',
    label: 'FAQ',
    category: 'core',
    defaultPage: {
      eyebrow: 'FAQ',
      title: 'A little clarity for your next step.',
      description:
        'Answers to common questions about YERH programmes, ventures, mentorship, and learning.',
      sections: [],
    },
  },
  {
    path: '/join',
    label: 'Get Started / Join YERH',
    category: 'core',
    defaultPage: {
      eyebrow: 'Get started',
      title: 'Where will your next step take you?',
      description: 'Connect as an entrepreneur, mentor, or partner institution.',
      sections: [],
    },
  },
  {
    path: '/institutions/apply',
    label: 'Partner Institution Onboarding',
    category: 'core',
    defaultPage: {
      eyebrow: 'Institution partnerships',
      title: 'Onboard your school, university, or hub.',
      description:
        'Apply to register your institution on the platform so your students and founders can affiliate, launch ventures, and access incubation pathways.',
      sections: [],
    },
  },
  {
    path: '/careers',
    label: 'Careers & Collaboration Hub',
    category: 'careers',
    defaultPage: {
      eyebrow: 'Careers & Collaboration',
      title: 'Build the future of youth enterprise with us.',
      description:
        'Whether you represent an institution, partner organization, experienced mentor, or impact investor, discover how you can shape young entrepreneurs across Kenya.',
      sections: [
        {
          title: 'Why collaborate with YERH',
          body: 'YERH connects verified institutions, ecosystem partners, seasoned mentors, and catalytic capital directly with youth founders ready to build resilient, market-tested ventures.',
        },
        {
          title: 'Clear pathways and direct review',
          body: 'Every institutional onboarding request and career collaboration application is reviewed directly by our platform administrators so you receive a tailored, accountable response.',
        },
      ],
    },
  },
  {
    path: '/careers/institutions',
    label: 'Register Your Institution (High Schools, Universities & Hubs)',
    category: 'careers',
    defaultPage: {
      eyebrow: 'Careers · Register Your Institution',
      title: 'Onboard your high school, university, or innovation hub.',
      description:
        'Bring structured entrepreneurship learning, verified student affiliation, cohort tracking, and Moodle classroom integration to your campus or hub.',
      sections: [
        {
          title: 'High Schools: Practical Enterprise & Facilitator Tools',
          body: 'Equip entrepreneurship clubs and business studies classes with structured venture teams, cohort milestone tracking, Moodle Teaching & Grading Guides, and verified YERH certificates.',
        },
        {
          title: 'Universities: Seamless Campus Verification & Incubation',
          body: 'Onboard student founders automatically via official university email domains, monitor student ventures from an institutional portal, and connect teams with external YERH mentors.',
        },
        {
          title: 'Innovation Hubs: Cohort Oversight & Demo Readiness',
          body: 'Manage incubated founders across multiple cohorts, track marketplace product approvals, verify fees cleanly, and showcase hub enterprises across the national ecosystem.',
        },
      ],
    },
  },
  {
    path: '/careers/partnerships',
    label: 'Partnerships',
    category: 'careers',
    defaultPage: {
      eyebrow: 'Careers · Partnerships',
      title: 'Partner with YERH to accelerate young founders.',
      description:
        'Co-host transformative events, sponsor ecosystem programmes, propose training themes, and connect directly with emerging youth-led enterprises.',
      sections: [
        {
          title: 'Host Events, Clinics & Bootcamps',
          body: 'Approved partners receive a dedicated Partner Dashboard to organize virtual or physical events, manage presenter lineups, and view verified attendee registrations.',
        },
        {
          title: 'Propose Training & Ecosystem Initiatives',
          body: 'Submit course proposals to our platform administrators, sponsor cohort challenges, and bridge market access gaps alongside Kenya’s youth enterprise community.',
        },
        {
          title: 'Visibility Across the Hub',
          body: 'Partner organizations are featured across our live homepage partner strip, event catalogues, and institutional outreach channels.',
        },
      ],
    },
  },
  {
    path: '/careers/mentorship',
    label: 'Mentorship',
    category: 'careers',
    defaultPage: {
      eyebrow: 'Careers · Mentorship',
      title: 'Guide the next generation of Kenyan founders.',
      description:
        'Share your operational wisdom, coach incubated ventures through structured stages, and build measurable entrepreneurial capability.',
      sections: [
        {
          title: 'Structured Venture Coaching & Moodle Access',
          body: 'Receive assigned ventures across high schools, universities, and hubs inside a single unified Mentor Dashboard and synced Moodle classroom.',
        },
        {
          title: 'Assess Incubation Stages & Propose Courses',
          body: 'Review student milestones, grade structured venture stages, answer questions in public forums as a recognized Mentor, and propose specialized courses to earn royalties.',
        },
        {
          title: 'Measurable Impact & Community Leadership',
          body: 'Track active and graduated ventures you have guided while building standing on the YERH Mentor Leaderboard.',
        },
      ],
    },
  },
  {
    path: '/careers/invest',
    label: 'Invest with Us',
    category: 'careers',
    defaultPage: {
      eyebrow: 'Careers · Invest with Us',
      title: 'Back vetted, incubation-ready youth enterprises.',
      description:
        'Partner with YERH to discover high-potential ventures completing structured milestones, market testing, and compliance readiness.',
      sections: [
        {
          title: 'Pipeline of Incubation-Vetted Founders',
          body: 'Access young entrepreneurs who have progressed through validated business planning, mentor grading, and real customer engagement on the YERH Shop.',
        },
        {
          title: 'Co-Design Grants, Fellowships & Capital Vehicles',
          body: 'Launch targeted funding challenges, seed prizes, or impact investment showcases supported by transparent cohort metrics and milestone verification.',
        },
        {
          title: 'Trusted Institutional Governance',
          body: 'Every venture, institution, and transaction on YERH is audited and overseen by platform administrators for transparency and long-term impact.',
        },
      ],
    },
  },
  {
    path: '/search',
    label: 'Search Hub',
    category: 'core',
    defaultPage: {
      eyebrow: 'Search the hub',
      title: 'Find your next possibility.',
      description: 'Search stories, insights, publications, and businesses across the hub.',
      sections: [],
    },
  },
  {
    path: '/saved',
    label: 'Saved Items',
    category: 'core',
    defaultPage: {
      eyebrow: 'Saved resources',
      title: 'Your inspiration, in one place.',
      description:
        'Articles, stories, and businesses you’ve saved on this browser. Come back whenever you need a little inspiration.',
      sections: [],
    },
  },
  {
    path: '/resources',
    label: 'Resources Overview',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Learning resources',
      title: 'Build your knowledge. Build your future.',
      description:
        'A practical starting point for your business journey. Explore lessons, guides, and ideas from the YERH collection.',
      sections: [],
    },
  },
  {
    path: '/learn',
    label: 'Courses Catalogue',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Learn',
      title: 'Courses',
      description:
        'Explore structured pathways built from the YERH resource collection to grow your enterprise.',
      sections: [],
    },
  },
  {
    path: '/workshops',
    label: 'Workshops',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Workshops',
      title: 'Learn by doing, together.',
      description: 'Hands-on entrepreneurship workshops and practical sessions across the hub.',
      sections: [],
    },
  },
  {
    path: '/webinars',
    label: 'Webinars',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Webinars',
      title: 'Ideas and learning, wherever you are.',
      description: 'Live and recorded webinar sessions with mentors and ecosystem leaders.',
      sections: [],
    },
  },
  {
    path: '/entrepreneurship/startups',
    label: 'New Start-Ups',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Entrepreneurship',
      title: 'New Start-Ups',
      description:
        'Start with the essentials: validate an idea, understand customers, keep records, and plan your business.',
      sections: [],
    },
  },
  {
    path: '/entrepreneurship/advanced',
    label: 'Intermediate / Advanced Business',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Entrepreneurship',
      title: 'Intermediate / Advanced Business',
      description: 'Strengthen operations and explore the skills needed for a growing enterprise.',
      sections: [],
    },
  },
  {
    path: '/entrepreneurship/wellbeing',
    label: 'General & Well-Being',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Entrepreneurship',
      title: 'General and Well-Being',
      description: 'Build sustainable working habits alongside your business skills.',
      sections: [],
    },
  },
  {
    path: '/entrepreneurship/funding',
    label: 'Funding Pathway',
    category: 'resources',
    defaultPage: {
      eyebrow: 'Entrepreneurship',
      title: 'Funding',
      description:
        'Explore funding preparation guides, investment readiness tools, and youth enterprise fund links.',
      sections: [],
    },
  },
  {
    path: '/publications',
    label: 'Publications Hub',
    category: 'publications',
    defaultPage: {
      eyebrow: 'Publications',
      title: 'Stories, ideas, and knowledge to build on.',
      description:
        'Your home for success stories, blogs, research, and reports from the YERH community.',
      sections: [],
    },
  },
  {
    path: '/publications/stories',
    label: 'Success Stories',
    category: 'publications',
    defaultPage: {
      eyebrow: 'Success stories',
      title: 'Every business starts with a story.',
      description:
        'Meet the people turning ambition into action. Discover their journeys, their lessons, and what keeps them going.',
      sections: [],
    },
  },
  {
    path: '/publications/blogs',
    label: 'Blogs & Articles',
    category: 'publications',
    defaultPage: {
      eyebrow: 'Blogs',
      title: 'Ideas worth exploring.',
      description: 'Practical perspectives, research, and stories from the YERH community.',
      sections: [],
    },
  },
  {
    path: '/publications/reports',
    label: 'Reports & Briefs',
    category: 'publications',
    defaultPage: {
      eyebrow: 'Publications',
      title: 'Knowledge that moves us forward.',
      description:
        'Reports, advocacy briefs, and research lessons from youth entrepreneurship work.',
      sections: [],
    },
  },
  {
    path: '/opportunities',
    label: 'Opportunities',
    category: 'benefits',
    defaultPage: {
      eyebrow: 'Benefits · Opportunities',
      title: 'Your next opportunity starts here.',
      description: 'Funding, market access and practical support for youth-led ventures.',
      sections: [],
    },
  },
  {
    path: '/events',
    label: 'Upcoming Events',
    category: 'benefits',
    defaultPage: {
      eyebrow: 'Benefits · Events',
      title: 'Connect. Learn. Put ideas into action.',
      description:
        'Explore workshops and webinars, find your next session and continue learning with the community.',
      sections: [],
    },
  },
  {
    path: '/events/archive',
    label: 'Events Archive',
    category: 'benefits',
    defaultPage: {
      eyebrow: 'Events & workshops',
      title: 'Learn together. Grow together.',
      description: 'Explore past workshops and gatherings hosted across the YERH community.',
      sections: [],
    },
  },
  {
    path: '/marketplace',
    label: 'Marketplace Directory',
    category: 'benefits',
    defaultPage: {
      eyebrow: 'Business directory',
      title: 'Built with purpose. Made in Kenya.',
      description: 'Discover youth enterprises across industries and the people building them.',
      sections: [],
    },
  },
  {
    path: '/network',
    label: 'YERH Network',
    category: 'community',
    defaultPage: {
      eyebrow: 'YERH · Network',
      title: 'Find your people. Grow your possibilities.',
      description: 'Meet entrepreneurs, exchange ideas, and grow through a connected community.',
      sections: [],
    },
  },
  {
    path: '/forums',
    label: 'Forums',
    category: 'community',
    defaultPage: {
      eyebrow: 'Forums',
      title: 'Ask. Share. Build together.',
      description:
        'Peer entrepreneurship, startup, and technology forums connecting founders and mentors.',
      sections: [],
    },
  },
  {
    path: '/yem/mentors',
    label: 'YEM Mentors',
    category: 'community',
    defaultPage: {
      eyebrow: 'YEM · Mentor',
      title: 'Experience worth sharing.',
      description: 'Learn how seasoned founders and practitioners mentor emerging youth ventures.',
      sections: [],
    },
  },
  {
    path: '/yem/mentees',
    label: 'YEM Mentees',
    category: 'community',
    defaultPage: {
      eyebrow: 'YEM · Mentee',
      title: 'A little guidance. A confident next step.',
      description: 'Get matched with experienced mentors to support your venture milestones.',
      sections: [],
    },
  },
  {
    path: '/privacy',
    label: 'Privacy Policy',
    category: 'legal',
    defaultPage: {
      eyebrow: 'Privacy',
      title: 'Your browsing, simply explained.',
      description: 'Information about privacy and data handling across the YERH platform.',
      sections: [],
    },
  },
  {
    path: '/terms',
    label: 'Terms & Conditions',
    category: 'legal',
    defaultPage: {
      eyebrow: 'Terms & conditions',
      title: 'Terms and Conditions',
      description: 'Platform terms governing use of YERH services, ventures, and learning tools.',
      sections: [],
    },
  },
  {
    path: '/cookies',
    label: 'Cookie Policy',
    category: 'legal',
    defaultPage: {
      eyebrow: 'TRANSPARENCY & PRIVACY',
      title: 'Cookie Policy',
      description:
        'Learn how the Youth Entrepreneurship Resource Hub uses cookies and local storage to power your experience.',
      sections: [],
    },
  },
];

const RESERVED_ROUTE_PREFIXES = [
  '/dashboard',
  '/api',
  '/ui',
  '/media',
  '/storage',
  '/login',
  '/register',
  '/account',
  '/reset-password',
  '/demo',
  '/local-account',
  '/sanctum',
  '/apply',
];

export function normalizePagePath(raw: string): string {
  const cleaned = (raw ?? '').trim().replace(/\\+/g, '/').replace(/\/+/g, '/').toLowerCase();
  if (!cleaned || cleaned === '/') return '/';
  const withLead = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return withLead.length > 1 ? withLead.replace(/\/+$/, '') : '/';
}

export function validateManagedPagePath(
  raw: string,
  mode: 'route' | 'custom',
): { path: string; error?: string } {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return {
      path: '',
      error:
        mode === 'custom'
          ? 'Enter a custom slug or nested subpage, e.g. cohort-2026 or programs/cohort-2026.'
          : 'Enter an app route or subpage path, e.g. /institutions/apply or /about/governance.',
    };
  }

  if (mode === 'custom') {
    const cleaned = trimmed
      .toLowerCase()
      .replace(/\\+/g, '/')
      .replace(/^\/+/, '')
      .replace(/^pages\//, '');
    const segments = cleaned
      .split('/')
      .map((seg) => seg.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
      .filter(Boolean);
    if (segments.length === 0) {
      return {
        path: '',
        error: 'Enter a valid slug such as cohort-2026 or programs/cohort-2026.',
      };
    }
    return { path: `/pages/${segments.join('/')}` };
  }

  if (/[?#\s]/.test(trimmed) || trimmed.includes('://')) {
    return {
      path: '',
      error: 'Use a relative path without spaces, protocol, query strings, or hashes.',
    };
  }

  const normalized = normalizePagePath(trimmed);
  if (normalized === '/') {
    return { path: normalized, error: 'Homepage hero is configured in the Homepage tab.' };
  }

  if (!/^\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/.test(normalized)) {
    return {
      path: '',
      error:
        'Paths may only contain letters, numbers, hyphens, underscores, and / for subpages (e.g. /institutions/apply).',
    };
  }

  if (
    RESERVED_ROUTE_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    return {
      path: normalized,
      error: `"${normalized}" is a reserved application or authentication route and cannot be edited here.`,
    };
  }

  return { path: normalized };
}

export function getSystemPageEntry(path: string): SystemPageEntry | undefined {
  const normalized = normalizePagePath(path);
  return SYSTEM_PAGE_REGISTRY.find((entry) => entry.path === normalized);
}

export function getDefaultManagedPage(path: string): ManagedPage | undefined {
  const found = getSystemPageEntry(path);
  return found ? structuredClone(found.defaultPage) : undefined;
}

export function isSystemRoute(path: string): boolean {
  return Boolean(getSystemPageEntry(path));
}

export function lookupManagedPage(
  pages: Record<string, ManagedPage> | undefined,
  pathname: string,
): ManagedPage | undefined {
  if (!pages) return undefined;
  if (Object.prototype.hasOwnProperty.call(pages, pathname)) {
    return pages[pathname];
  }
  const normalizedTarget = normalizePagePath(pathname);
  if (Object.prototype.hasOwnProperty.call(pages, normalizedTarget)) {
    return pages[normalizedTarget];
  }
  for (const [key, value] of Object.entries(pages)) {
    if (normalizePagePath(key) === normalizedTarget) {
      return value;
    }
  }
  return undefined;
}
