import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentPath, filterContent, type Catalog } from '../src/domain/content.ts';
import { emailDraftHref } from '../src/features/contact/contact.ts';

import { mediaAssets } from '../src/config/media.ts';
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
