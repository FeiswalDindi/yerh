import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentPath, filterContent, type Catalog } from '../src/domain/content.ts';
import { emailDraftHref } from '../src/features/contact/contact.ts';

import { mediaAssets } from '../src/config/media.ts';
import { INLINE_YERH_LOGO } from '../src/config/brand-inline.ts';
import { MEDIA_WEBP_VARIANTS } from '../src/config/media-variants.ts';
import { suggestPhotoFilename } from '../src/shared/downloadPhoto.ts';
import { buildMediaSrcSet, getMediaDimensions, resolveMediaUrl } from '../src/shared/mediaUrl.ts';
import { resolveStatusMeta } from '../src/shared/status-meta.ts';
import {
  getSystemPageEntry,
  lookupManagedPage,
  normalizePagePath,
  SYSTEM_PAGE_REGISTRY,
  validateManagedPagePath,
} from '../src/features/platform/server/cms/cms-page-registry.ts';
import { collectSiteLibrary } from '../src/features/platform/server/cms/site-library.ts';
import { resolveImportantLinkMode } from '../src/domain/hub.ts';
import { normalizeHomeSidebarOrder } from '../src/domain/site.ts';
import { coerceNullStrings } from '../src/domain/cms-sanitize.ts';
function fixture(name: string) {
  return JSON.parse(
    readFileSync(new URL(`../src/mocks/data/${name}.json`, import.meta.url), 'utf8'),
  );
}
const catalog = {
  items: ['blogs', 'stories', 'businesses', 'events', 'reports'].flatMap(fixture),
  lessons: fixture('lessons'),
  courses: fixture('learning'),
  topics: fixture('entrepreneurship'),
  faqs: fixture('faqs'),
  homepage: fixture('homepage'),
  media: { ...mediaAssets, partners: fixture('partners') },
} as Catalog;
const aliases = JSON.parse(
  readFileSync(new URL('../src/content/legacy-routes.json', import.meta.url), 'utf8'),
) as Record<string, string>;

test('every migrated record has a unique reachable path and a traceable source', () => {
  const paths = catalog.items.map(contentPath);
  assert.equal(new Set(paths).size, paths.length);
  for (const item of catalog.items) {
    assert.match(item.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(item.source.path.endsWith('/index.html'));
    assert.equal(
      aliases[
        `/${item.source.path.replace('yerh-kenya.kcau.ac.ke/', '').replace('/index.html', '')}`
      ],
      contentPath(item),
    );
  }
});
test('all bundled content images exist and no scriptable URLs reach the renderer', () => {
  for (const item of catalog.items) {
    if (item.image) assert.ok(existsSync(resolve('public', `.${item.image}`)), item.image);
    for (const url of [...item.videos, ...item.downloads.map((d) => d.href)]) {
      assert.ok(url.startsWith('https://') || url.startsWith('/media/'), url);
    }
    assert.ok(
      !item.blocks.some((block) => /<script|Leave a Reply|Home About Us FAQ/.test(block.text)),
      item.id,
    );
  }
  for (const image of [
    catalog.media.logo,
    catalog.media.wordmark,
    catalog.media.team,
    catalog.media.developers,
    catalog.media.workshop,
    ...catalog.media.partners.map((p) => p.image),
  ]) {
    assert.ok(existsSync(resolve('public', `.${image}`)), image);
  }
});
test('search combines case-insensitive words and category selection', () => {
  assert.equal(
    filterContent(catalog.items, '  DEBBIE  Gitonga ')[0]?.id,
    'debbie-gitonga-entrepreneur',
  );
  assert.equal(filterContent(catalog.items, 'debbie', 'Technology').length, 0);
  assert.ok(filterContent(catalog.items, '', 'Agribusiness').length >= 2);
  assert.equal(filterContent(catalog.items, 'no-such-thing-987654321').length, 0);
});
test('twelve original lessons retain their actual external video links', () => {
  assert.equal(catalog.lessons.length, 12);
  assert.equal(new Set(catalog.lessons.map((l) => l.id)).size, 12);
  for (const lesson of catalog.lessons)
    assert.match(lesson.href, /^https:\/\/(www\.)?youtube\.com\/watch\?v=/);
});
test('email draft preserves line breaks and safely encodes user input', () => {
  const href = emailDraftHref('hello@example.com', {
    name: 'Jane & Co',
    email: 'jane@example.com',
    topic: 'Mentorship',
    message: 'Hello\nWhat about A&B? #idea',
  });
  const parsed = new URL(href);
  assert.equal(parsed.searchParams.get('subject'), 'YERH enquiry: Mentorship');
  assert.ok(parsed.searchParams.get('body')?.includes('Hello\nWhat about A&B? #idea'));
  assert.ok(parsed.searchParams.get('body')?.includes('Jane & Co'));
});
test('photo downloads derive clean filenames from labels, paths, and MIME types', () => {
  assert.equal(
    suggestPhotoFilename('/media/workshop-hero-photo.webp?v=2', 'North-South Cooperation!'),
    'north-south-cooperation.webp',
  );
  assert.equal(
    suggestPhotoFilename('/media/health-c8d73354.png', 'Health Banner'),
    'health-banner.png',
  );
  assert.equal(
    suggestPhotoFilename(
      '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000',
      'Youth Forum Hero',
      'image/png',
    ),
    'youth-forum-hero.png',
  );
  assert.equal(
    suggestPhotoFilename(
      '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000',
      '',
      'image/webp',
    ),
    'yerh-photo.webp',
  );
  assert.equal(
    suggestPhotoFilename('/media/be-part-of-the-team-3382b8d1.jpg'),
    'be-part-of-the-team-3382b8d1.jpg',
  );
});

test('media optimizer helpers upgrade bundled paths, add width params, and verify inline assets', () => {
  assert.ok(INLINE_YERH_LOGO.startsWith('data:image/webp;base64,'));
  assert.ok(Object.keys(MEDIA_WEBP_VARIANTS).length >= 20);

  for (const webpPath of Object.values(MEDIA_WEBP_VARIANTS)) {
    assert.ok(existsSync(resolve('public', `.${webpPath}`)), webpPath);
  }

  assert.equal(
    resolveMediaUrl('/media/comfort-worms-e046b580.jpg', { baseUrl: '/ui/' }),
    '/ui/media/comfort-worms-e046b580.webp',
  );
  assert.equal(
    resolveMediaUrl('/media/comfort-worms-e046b580.jpg', {
      baseUrl: '/ui/',
      preferOriginal: true,
    }),
    '/ui/media/comfort-worms-e046b580.jpg',
  );
  assert.equal(
    resolveMediaUrl('/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000', { width: 480 }),
    '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000?w=480',
  );
  assert.equal(
    resolveMediaUrl('/api/v1/marketplace-sectors/5/image?v=abc123def456', { width: 320 }),
    '/api/v1/marketplace-sectors/5/image?v=abc123def456&w=320',
  );
  assert.equal(
    resolveMediaUrl('/api/v1/marketplace/solar-dryer/image?v=abc123def456', { width: 480 }),
    '/api/v1/marketplace/solar-dryer/image?v=abc123def456&w=480',
  );
  assert.equal(
    buildMediaSrcSet('/api/v1/marketplace/solar-dryer/image?v=abc123def456', [320, 640]),
    '/api/v1/marketplace/solar-dryer/image?v=abc123def456&w=320 320w, /api/v1/marketplace/solar-dryer/image?v=abc123def456&w=640 640w',
  );
  assert.equal(
    resolveMediaUrl('/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000?download=1', {
      width: 320,
    }),
    '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000?download=1',
  );
  assert.equal(
    resolveMediaUrl('https://example.com/photo.jpg', { width: 320 }),
    'https://example.com/photo.jpg',
  );
  assert.equal(resolveMediaUrl(INLINE_YERH_LOGO, { width: 320 }), INLINE_YERH_LOGO);

  assert.equal(
    buildMediaSrcSet('/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000', [320, 640]),
    '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000?w=320 320w, /api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000?w=640 640w',
  );
  assert.equal(buildMediaSrcSet('/media/comfort-worms-e046b580.jpg'), undefined);

  assert.deepEqual(getMediaDimensions('/ui/media/yerh-wordmark.webp?v=1'), {
    width: 468,
    height: 95,
  });
});

test('status metadata maps CMS and admin states to intuitive icons and tones', () => {
  assert.deepEqual(resolveStatusMeta('published'), {
    key: 'published',
    tone: 'success',
    icon: 'check',
    label: 'Published',
  });
  assert.deepEqual(resolveStatusMeta('Live'), {
    key: 'live',
    tone: 'success',
    icon: 'check',
    label: 'Live',
  });
  assert.deepEqual(resolveStatusMeta('draft'), {
    key: 'draft',
    tone: 'warning',
    icon: 'draft',
    label: 'Draft',
  });
  assert.deepEqual(resolveStatusMeta('unsaved_edits'), {
    key: 'unsaved edits',
    tone: 'warning',
    icon: 'draft',
    label: 'Unsaved edits',
  });
  assert.deepEqual(resolveStatusMeta('archived'), {
    key: 'archived',
    tone: 'muted',
    icon: 'archive',
    label: 'Archived',
  });
  assert.deepEqual(resolveStatusMeta('pending'), {
    key: 'pending',
    tone: 'pending',
    icon: 'clock',
    label: 'Pending',
  });
  assert.deepEqual(resolveStatusMeta('approved'), {
    key: 'approved',
    tone: 'success',
    icon: 'check',
    label: 'Approved',
  });
  assert.deepEqual(resolveStatusMeta('rejected'), {
    key: 'rejected',
    tone: 'danger',
    icon: 'x',
    label: 'Rejected',
  });
  assert.deepEqual(resolveStatusMeta('suspended'), {
    key: 'suspended',
    tone: 'danger',
    icon: 'ban',
    label: 'Suspended',
  });
  assert.deepEqual(resolveStatusMeta('in_progress'), {
    key: 'in progress',
    tone: 'info',
    icon: 'progress',
    label: 'In progress',
  });
  assert.deepEqual(resolveStatusMeta('shortlisted'), {
    key: 'shortlisted',
    tone: 'info',
    icon: 'star',
    label: 'Shortlisted',
  });
  assert.deepEqual(resolveStatusMeta('private'), {
    key: 'private',
    tone: 'muted',
    icon: 'lock',
    label: 'Private',
  });
  assert.deepEqual(resolveStatusMeta('disabled'), {
    key: 'disabled',
    tone: 'muted',
    icon: 'ban',
    label: 'Disabled',
  });
  assert.deepEqual(resolveStatusMeta('resit_available'), {
    key: 'resit available',
    tone: 'danger',
    icon: 'alert',
    label: 'Resit available',
  });
  assert.deepEqual(resolveStatusMeta('new'), {
    key: 'new',
    tone: 'pending',
    icon: 'clock',
    label: 'New',
  });
  assert.deepEqual(resolveStatusMeta('read'), {
    key: 'read',
    tone: 'info',
    icon: 'progress',
    label: 'Read',
  });
  assert.deepEqual(resolveStatusMeta('resolved'), {
    key: 'resolved',
    tone: 'success',
    icon: 'check',
    label: 'Resolved',
  });
  assert.equal(fixture('team').sourceUrl, '');
});

test('CMS page registry resolves /institutions/apply, subpages, and rejects reserved routes', () => {
  const applyEntry = getSystemPageEntry('/institutions/apply/');
  assert.equal(applyEntry?.path, '/institutions/apply');
  assert.ok(SYSTEM_PAGE_REGISTRY.some((entry) => entry.path === '/entrepreneurship/startups'));

  assert.equal(normalizePagePath('///About/'), '/about');
  assert.equal(normalizePagePath('/'), '/');

  assert.deepEqual(validateManagedPagePath('institutions/apply', 'route'), {
    path: '/institutions/apply',
  });
  assert.deepEqual(validateManagedPagePath('/about/governance/', 'route'), {
    path: '/about/governance',
  });
  assert.deepEqual(validateManagedPagePath('programs/Cohort 2026!', 'custom'), {
    path: '/pages/programs/cohort-2026',
  });

  for (const reserved of ['/dashboard/foo', '/api/v1/test', '/login', '/account/settings', '/']) {
    const res = validateManagedPagePath(reserved, 'route');
    assert.ok(res.error, `Expected error for ${reserved}`);
  }

  const found = lookupManagedPage(
    {
      '/institutions/apply': {
        eyebrow: 'Institution partnerships',
        title: 'Custom Apply Hero',
        description: 'Onboard institutions.',
        sections: [],
      },
    },
    '/institutions/apply/',
  );
  assert.equal(found?.title, 'Custom Apply Hero');
});

test('Site library collector puts promoted uploads first and deduplicates built-in catalog assets', () => {
  const siteLib = collectSiteLibrary(catalog, [
    {
      id: 1,
      uuid: '11111111-1111-4111-8111-111111111111',
      url: '/api/v1/cms/media/11111111-1111-4111-8111-111111111111',
      original_name: 'promoted-hero.png',
      mime_type: 'image/png',
      size_bytes: 20480,
      alt_text: 'Promoted hero photo',
      folder: 'hero',
      in_site_library: true,
    },
    {
      id: 2,
      uuid: '22222222-2222-4222-8222-222222222222',
      url: '/api/v1/cms/media/22222222-2222-4222-8222-222222222222',
      original_name: 'private-upload.png',
      mime_type: 'image/png',
      size_bytes: 10240,
      alt_text: 'Private upload',
      folder: 'general',
      in_site_library: false,
    },
  ]);

  assert.equal(siteLib[0]?.source, 'uploaded');
  assert.equal(siteLib[0]?.assetId, 1);
  assert.equal(
    siteLib.some((item) => item.name === 'private-upload.png'),
    false,
  );
  assert.ok(siteLib.some((item) => item.source === 'builtin' && item.url === catalog.media.logo));
  assert.equal(new Set(siteLib.map((item) => item.url)).size, siteLib.length);
});

test('Important links resolve new-tab, same-page internal, and same-page external navigation modes', () => {
  assert.equal(resolveImportantLinkMode({ href: 'https://www.kcau.ac.ke/' }), 'new-tab');
  assert.equal(
    resolveImportantLinkMode({ href: 'https://www.kcau.ac.ke/', openInNewTab: true }),
    'new-tab',
  );
  assert.equal(
    resolveImportantLinkMode({ href: '/opportunities', openInNewTab: false }),
    'same-page-internal',
  );
  assert.equal(
    resolveImportantLinkMode({ href: 'https://www.kcau.ac.ke/', openInNewTab: false }),
    'same-page-external',
  );
  assert.equal(
    resolveImportantLinkMode({ href: '//external.test', openInNewTab: false }),
    'same-page-external',
  );
});

test('CMS null-string sanitizer replaces null leaves with empty strings while keeping primitives', () => {
  const dirty = {
    slides: [
      {
        eyebrow: null,
        title: 'Idea to',
        secondLine: null,
        archived: false,
        count: 3,
      },
    ],
    announcement: {
      enabled: true,
      text: null,
    },
    tags: ['a', null, 'b'],
  };

  assert.deepEqual(coerceNullStrings(dirty), {
    slides: [
      {
        eyebrow: '',
        title: 'Idea to',
        secondLine: '',
        archived: false,
        count: 3,
      },
    ],
    announcement: {
      enabled: true,
      text: '',
    },
    tags: ['a', '', 'b'],
  });
});

test('Homepage sidebar order normalizer and site.json Resources navigation match configuration rules', () => {
  assert.deepEqual(normalizeHomeSidebarOrder(['statistics', 'links', 'invalid', 'links']), [
    'statistics',
    'links',
    'news',
    'partners',
    'socials',
  ]);
  assert.deepEqual(normalizeHomeSidebarOrder(undefined), [
    'news',
    'links',
    'partners',
    'statistics',
    'socials',
  ]);

  const siteFixture = fixture('site') as {
    navigation: { id: string; label: string; children?: { id: string; label: string }[] }[];
  };
  const resources = siteFixture.navigation.find((item) => item.id === 'resources');
  assert.ok(resources);
  const children = resources.children ?? [];
  assert.equal(children.find((item) => item.id === 'marketplace')?.label, 'Shop');
  assert.equal(
    children.some((item) => item.id === 'workshops' || item.id === 'webinars'),
    false,
  );
});
