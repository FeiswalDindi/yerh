import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { youtubeEmbedUrl } from '../src/domain/media.ts';
import { parseCookieConsent } from '../src/services/cookie-consent.ts';
test('iframe destinations accept only HTTPS YouTube videos with valid IDs', () => {
  const expected = 'https://www.youtube-nocookie.com/embed/MXLhGTEyZGc';
  for (const url of [
    'https://youtu.be/MXLhGTEyZGc',
    'https://www.youtube.com/watch?v=MXLhGTEyZGc&foo=bar',
    'https://www.youtube.com/embed/MXLhGTEyZGc',
  ])
    assert.equal(youtubeEmbedUrl(url), expected);
  for (const url of [
    'javascript:alert(1)',
    'https://evil.test/embed/MXLhGTEyZGc',
    'https://youtube.com.evil.test/watch?v=MXLhGTEyZGc',
    'http://youtube.com/watch?v=MXLhGTEyZGc',
    'https://youtu.be/not-an-id',
  ])
    assert.equal(youtubeEmbedUrl(url), null);
});
test('unrecognized consent values never enable multimedia', () => {
  assert.equal(parseCookieConsent('all'), 'all');
  assert.equal(parseCookieConsent('essential'), 'essential');
  for (const value of [null, undefined, 'true', 'accepted', {}, false])
    assert.equal(parseCookieConsent(value), null);
});
test('homepage media and database-like metadata resolve without name-based UI rules', () => {
  const fixture = (name: string) =>
    JSON.parse(readFileSync(new URL(`../src/mocks/data/${name}.json`, import.meta.url), 'utf8'));
  const home = fixture('homepage');
  assert.ok(youtubeEmbedUrl(home.socialVideo.url));
  assert.ok(home.statisticsNote);
  for (const slide of home.slides) assert.ok(['photo', 'green'].includes(slide.theme));
  for (const story of fixture('stories'))
    assert.ok(story.storyGroups.every((g: string) => ['Entrepreneur', 'Startups'].includes(g)));
  for (const business of fixture('businesses'))
    for (const link of business.contactLinks ?? []) assert.match(link.href, /^(https:\/\/|tel:)/);
});
