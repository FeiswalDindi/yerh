import type { CmsSnapshot, Opportunity } from './platform';
import type { DemoState } from './demo';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const fields = (v: unknown, keys: string[]) =>
  object(v) && keys.every((k) => typeof v[k] === 'string');
const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const date = (v: unknown) =>
  v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));
const unique = (values: unknown[]) => new Set(values).size === values.length;
export function safeUrl(value: string, allowEmpty = true): boolean {
  if (!value) return allowEmpty;
  if (value.startsWith('/') && !value.startsWith('//') && !/[\\\s<>]/.test(value)) return true;
  try {
    const u = new URL(value);
    return ['https:', 'mailto:', 'tel:'].includes(u.protocol);
  } catch {
    return false;
  }
}
export function assertOpportunity(value: Opportunity) {
  demand(
    fields(value, [
      'id',
      'slug',
      'ownerId',
      'title',
      'summary',
      'description',
      'category',
      'organiser',
      'type',
      'mode',
      'location',
      'eligibility',
      'benefits',
      'externalUrl',
      'status',
      'image',
    ]),
    'Opportunity fields are incomplete.',
  );
  demand(
    value.title.trim().length >= 5 && /^[a-z0-9][a-z0-9-]*$/.test(value.slug),
    'Use a title and a lowercase URL slug.',
  );
  demand(
    ['internal', 'external'].includes(value.type) &&
      ['online', 'in_person', 'hybrid'].includes(value.mode) &&
      ['draft', 'review', 'published', 'closed', 'archived'].includes(value.status),
    'Invalid opportunity type, delivery mode or status.',
  );
  demand(
    strings(value.sectors) &&
      strings(value.stages) &&
      strings(value.documents) &&
      typeof value.rolling === 'boolean' &&
      typeof value.featured === 'boolean',
    'Opportunity tags are invalid.',
  );
  demand(
    [value.opensAt, value.deadline, value.publishedAt].every(date),
    'Opportunity dates must be valid ISO dates.',
  );
  demand(value.rolling || !!value.deadline, 'Set a deadline or enable rolling applications.');
  demand(
    !value.opensAt || !value.deadline || Date.parse(value.deadline) > Date.parse(value.opensAt),
    'Deadline must follow the opening date.',
  );
  demand(
    value.capacity === null || (Number.isInteger(value.capacity) && value.capacity > 0),
    'Capacity must be a positive integer.',
  );
  demand(
    safeUrl(value.externalUrl) && safeUrl(value.image),
    'Use safe opportunity links and images.',
  );
  demand(
    value.type !== 'external' || value.externalUrl.startsWith('https://'),
    'External opportunities require an HTTPS application URL.',
  );
}
/** Validate CMS payloads before persisting or exposing them to public components. */
export function assertCmsSnapshot(value: CmsSnapshot, state?: DemoState) {
  demand(object(value) && object(value.catalog), 'A full catalog is required.');
  const c = value.catalog;
  for (const key of ['items', 'lessons', 'courses', 'topics', 'faqs'] as const)
    demand(Array.isArray(c[key]), `Missing ${key} collection.`);
  demand(
    object(c.homepage) && object(c.media) && object(c.sidebar) && object(c.terms) && object(c.site),
    'Site configuration is incomplete.',
  );
  demand(
    fields(c.media, ['team', 'developers', 'workshop', 'business', 'logo', 'wordmark']) &&
      Array.isArray(c.media.partners) &&
      c.media.partners.every((p) => fields(p, ['name', 'image', 'url'])),
    'Media assets are incomplete.',
  );
  const ids = new Set(c.items.map((i) => i.id));
  demand(
    unique(c.items.map((i) => i.id)) && unique(c.items.map((i) => `${i.kind}:${i.slug}`)),
    'Content IDs and URLs must be unique.',
  );
  for (const item of c.items) {
    demand(
      fields(item, ['id', 'slug', 'title', 'category', 'excerpt', 'imageAlt', 'kind']) &&
        ['article', 'story', 'business', 'event', 'publication', 'resource'].includes(item.kind),
      'Invalid content record.',
    );
    demand(
      item.title.trim() && /^[a-z0-9][a-z0-9-]*$/.test(item.slug),
      'Content titles and lowercase URL slugs are required.',
    );
    demand(
      date(item.publishedAt) && (item.image === null || typeof item.image === 'string'),
      'Invalid content date or image.',
    );
    demand(
      Array.isArray(item.blocks) &&
        item.blocks.every(
          (b) =>
            fields(b, ['type', 'text']) && ['paragraph', 'heading', 'list-item'].includes(b.type),
        ) &&
        Array.isArray(item.downloads) &&
        item.downloads.every(
          (d) => fields(d, ['label', 'href']) && typeof d.availableLocally === 'boolean',
        ) &&
        strings(item.videos),
      'Invalid article body or media.',
    );
    demand(fields(item.source, ['path', 'url', 'sha256']), 'Preserve content provenance.');
    demand(
      (!item.contactLinks ||
        (Array.isArray(item.contactLinks) &&
          item.contactLinks.every((l) => fields(l, ['label', 'text', 'href'])))) &&
        (!item.displayLines || fields(item.displayLines, ['line1', 'line2'])) &&
        (!item.storyGroups || strings(item.storyGroups)),
      'Content presentation fields are invalid.',
    );
    demand(
      item.status === undefined || ['published', 'archived'].includes(item.status),
      'Invalid content publication state.',
    );
  }
  for (const key of [
    'featuredStories',
    'featuredBusinesses',
    'featuredBlogs',
    'featuredGuides',
  ] as const)
    demand(
      strings(c.homepage[key]) && c.homepage[key].every((id) => ids.has(id)),
      `Repair ${key} references before publishing.`,
    );
  demand(
    Array.isArray(c.homepage.slides) &&
      c.homepage.slides.length > 0 &&
      c.homepage.slides.every((s) =>
        fields(s, [
          'title',
          'text',
          'image',
          'href',
          'eyebrow',
          'alt',
          'secondLine',
          'accent',
          'action',
          'caption',
        ]),
      ),
    'At least one complete homepage slide is required.',
  );
  demand(
    Array.isArray(c.homepage.statistics) &&
      c.homepage.statistics.every((s) => fields(s, ['label', 'value', 'tone'])) &&
      fields(c.homepage.socialVideo, ['url', 'title']) &&
      typeof c.homepage.statisticsNote === 'string' &&
      Array.isArray(c.homepage.importantLinks) &&
      c.homepage.importantLinks.every((l) => fields(l, ['label', 'href'])),
    'Homepage widgets are incomplete.',
  );
  const lessonIds = new Set(c.lessons.map((l) => l.id));
  const courseIds = new Set(c.courses.map((l) => l.id));
  demand(
    unique(c.lessons.map((l) => l.id)) && unique(c.courses.map((l) => l.id)),
    'Learning IDs must be unique.',
  );
  demand(
    c.lessons.every((l) => fields(l, ['id', 'title', 'href', 'track'])) &&
      c.courses.every(
        (l) =>
          fields(l, ['id', 'title', 'description', 'level']) &&
          strings(l.lessonIds) &&
          l.lessonIds.length > 0 &&
          unique(l.lessonIds) &&
          l.lessonIds.every((id) => lessonIds.has(id)),
      ),
    'Courses must reference unique existing lessons.',
  );
  demand(
    c.topics.every(
      (t) =>
        fields(t, ['id', 'title', 'description', 'lessonTrack', 'sourceNote']) &&
        strings(t.guideIds) &&
        t.guideIds.every((id) => ids.has(id)) &&
        strings(t.checklist),
    ),
    'Topic references are invalid.',
  );
  demand(
    c.faqs.every((f) => fields(f, ['question', 'answer'])),
    'FAQs require a question and answer.',
  );
  demand(
    strings(c.sidebar.featuredIds) &&
      c.sidebar.featuredIds.every((id) => ids.has(id)) &&
      strings(c.sidebar.featuredCourseIds) &&
      c.sidebar.featuredCourseIds.every((id) => courseIds.has(id)),
    'Sidebar featured references are invalid.',
  );
  demand(
    Array.isArray(c.sidebar.popularity) &&
      c.sidebar.popularity.every(
        (p) => ids.has(p.contentId) && Number.isInteger(p.likes) && p.likes >= 0,
      ) &&
      Array.isArray(c.sidebar.comments) &&
      c.sidebar.comments.every(
        (p) =>
          fields(p, ['id', 'contentId', 'authorId', 'body', 'createdAt']) &&
          ids.has(p.contentId) &&
          date(p.createdAt),
      ) &&
      Array.isArray(c.sidebar.advertisements) &&
      c.sidebar.advertisements.every(
        (a) =>
          fields(a, ['id', 'title', 'text', 'action', 'href', 'imageAlt']) &&
          (a.image === null || typeof a.image === 'string'),
      ),
    'Sidebar records are invalid.',
  );
  demand(
    fields(c.terms, ['title', 'effectiveDate', 'intro', 'contactEmail', 'source']) &&
      date(c.terms.effectiveDate) &&
      strings(c.terms.summary) &&
      Array.isArray(c.terms.sections) &&
      c.terms.sections.every((s) => typeof s.title === 'string' && strings(s.paragraphs)),
    'Terms document is incomplete.',
  );
  demand(
    fields(c.site, ['name', 'slogan']) &&
      fields(c.site.contact, ['email', 'phone', 'whatsapp', 'address']) &&
      Array.isArray(c.site.socials) &&
      object(c.site.pages) &&
      object(c.site.homeSections),
    'Site settings are incomplete.',
  );
  demand(
    c.site.socials.every((s) => fields(s, ['label', 'href'])) &&
      Object.values(c.site.homeSections).every((v) => typeof v === 'boolean'),
    'Social links and homepage visibility settings are invalid.',
  );
  const navIds: string[] = [];
  function nav(nodes: unknown, depth = 0) {
    demand(Array.isArray(nodes) && depth < 5, 'Navigation is invalid or too deeply nested.');
    for (const n of nodes) {
      demand(fields(n, ['id', 'label', 'href']), 'Each navigation item needs a label and link.');
      navIds.push(n.id as string);
      if (n.children !== undefined) nav(n.children, depth + 1);
    }
  }
  nav(c.site.navigation);
  demand(unique(navIds), 'Navigation IDs must be unique.');
  for (const [path, page] of Object.entries(c.site.pages)) {
    demand(
      path.startsWith('/') && !/^\/(dashboard|profile|login|register|apply)/.test(path),
      'Protected workflows cannot be overridden by a CMS page.',
    );
    demand(
      fields(page, ['title', 'eyebrow', 'description']) &&
        Array.isArray(page.sections) &&
        page.sections.every((s) => fields(s, ['title', 'body'])),
      'Page content is invalid.',
    );
  }
  demand(
    Array.isArray(value.sessions) && Array.isArray(value.opportunities),
    'Event/opportunity collections are required.',
  );
  demand(
    unique(value.sessions.map((s) => s.id)) &&
      unique(value.opportunities.map((s) => s.id)) &&
      unique(value.opportunities.map((s) => s.slug)),
    'Event/opportunity IDs and slugs must be unique.',
  );
  for (const s of value.sessions) {
    demand(
      fields(s, ['id', 'title', 'summary', 'type', 'status', 'timezone', 'venue']) &&
        ['workshop', 'webinar', 'bootcamp', 'masterclass', 'summit', 'exhibition'].includes(
          s.type,
        ) &&
        ['upcoming', 'completed', 'postponed'].includes(s.status) &&
        strings(s.hostIds) &&
        [s.startsAt, s.endsAt, s.registrationDeadline].every(date),
      'Session fields are invalid.',
    );
    try {
      new Intl.DateTimeFormat('en', { timeZone: s.timezone });
    } catch {
      throw new Error('Invalid session timezone.');
    }
    demand(
      s.status !== 'upcoming' ||
        (!!s.startsAt && !!s.endsAt && Date.parse(s.endsAt) > Date.parse(s.startsAt)),
      'Upcoming sessions require a valid start/end range.',
    );
    demand(
      s.capacity === null || (Number.isInteger(s.capacity) && s.capacity > 0),
      'Session capacity must be positive.',
    );
    if (state) {
      demand(
        s.hostIds.every((id) => state.accounts.some((a) => a.id === id)),
        'A session host is missing.',
      );
      demand(
        s.capacity === null ||
          s.capacity >=
            state.registrations.filter((r) => r.sessionId === s.id && r.status !== 'cancelled')
              .length,
        'Capacity cannot fall below existing reservations.',
      );
    }
  }
  for (const opp of value.opportunities) assertOpportunity(opp);
  if (value.community) {
    demand(
      Array.isArray(value.community.groups) && Array.isArray(value.community.forums),
      'Community collections are required.',
    );
    demand(
      unique(value.community.groups.map((g) => g.id)) &&
        unique(value.community.forums.map((f) => f.id)),
      'Community IDs must be unique.',
    );
    demand(
      value.community.groups.every((g) => fields(g, ['id', 'name', 'description', 'category'])) &&
        value.community.forums.every(
          (f) =>
            fields(f, ['id', 'name', 'description']) &&
            (!f.groupId || value.community!.groups.some((g) => g.id === f.groupId)),
        ),
      'Community references are invalid.',
    );
    if (state)
      demand(
        state.threads.every((t) => value.community!.forums.some((f) => f.id === t.forumId)) &&
          state.groups
            .filter((g) => g.memberIds.length)
            .every((g) => value.community!.groups.some((next) => next.id === g.id)),
        'Retain groups and forums that have existing members or discussions.',
      );
  }
  if (state) {
    demand(
      state.registrations.every((r) => value.sessions.some((s) => s.id === r.sessionId)),
      'Do not delete sessions with registrations.',
    );
    demand(
      state.platform.opportunityApplications.every((a) =>
        value.opportunities.some((o) => o.id === a.opportunityId),
      ),
      'Do not delete opportunities with applications.',
    );
    demand(
      Object.values(state.platform.enrollments)
        .flat()
        .every((id) => courseIds.has(id)) &&
        state.platform.certificates.every((c) => courseIds.has(c.courseId)),
      'Do not delete courses with enrollments or issued certificates.',
    );
    demand(
      value.opportunities.every((o) => state.accounts.some((a) => a.id === o.ownerId)),
      'Opportunity owners must be existing accounts.',
    );
    demand(
      value.opportunities.every(
        (o) =>
          o.capacity === null ||
          o.capacity >=
            state.platform.opportunityApplications.filter(
              (a) =>
                a.opportunityId === o.id &&
                ['submitted', 'shortlisted', 'accepted'].includes(a.status),
            ).length,
      ),
      'Opportunity limits cannot fall below active applications.',
    );
    demand(
      value.opportunities.every(
        (o) =>
          !state.platform.opportunityApplications.some((a) => a.opportunityId === o.id) ||
          o.type === 'internal',
      ),
      'Keep the internal application route for opportunities with existing applications.',
    );
    demand(
      c.sidebar.comments.every((c) => state.accounts.some((a) => a.id === c.authorId)),
      'Sidebar comment authors must be existing members.',
    );
  }
  function urls(node: unknown, key = '') {
    if (typeof node === 'string' && /^(href|url|image|externalUrl|website)$/i.test(key))
      demand(safeUrl(node), `Unsafe URL in ${key}.`);
    else if (Array.isArray(node)) node.forEach((x) => urls(x, key === 'videos' ? 'url' : ''));
    else if (object(node)) Object.entries(node).forEach(([k, v]) => urls(v, k));
  }
  urls(value);
}
