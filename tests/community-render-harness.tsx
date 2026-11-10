import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoContext } from '../src/app/useDemo';
import { ContentContext } from '../src/app/useCatalog';
import { createDemoSeed } from '../src/services/demo-repository';
import { mockContentRepository } from '../src/services/mock-content-repository';
import { MemberProfilePage } from '../src/features/community/MemberProfilePage';
import { NetworkPage } from '../src/features/community/NetworkPage';
import { GroupPage } from '../src/features/community/GroupPage';
import { ForumsPage } from '../src/features/community/ForumsPage';
import { ThreadPage } from '../src/features/community/ThreadPage';
import { SessionPage } from '../src/features/resources/SessionPage';
import { EventCollectionPage } from '../src/features/resources/EventCollectionPage';
import { ContentDetail } from '../src/features/content/ContentDetail';
import { ContentDirectory } from '../src/features/content/ContentDirectory';
import { TermsPage } from '../src/features/legal/TermsPage';
import { TermsSummary } from '../src/features/legal/TermsDialog';
import { StoriesSection } from '../src/features/home/StoriesSection';

/** Server-render smoke checks supplement domain tests when interactive browser QA is unavailable. */
export async function checkCommunityRendering() {
  const state = createDemoSeed();
  const catalog = await mockContentRepository.loadCatalog();
  function render(path: string, activeId: string | null = null) {
    const account = state.accounts.find((a) => a.id === activeId) ?? null;
    return renderToStaticMarkup(
      <DemoContext.Provider
        value={{
          state: { ...state, activeAccountId: activeId },
          account,
          enabled: true,
          error: '',
          execute: () => false,
          reset: () => {},
          clearError: () => {},
        }}
      >
        <ContentContext.Provider value={catalog}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/network" element={<NetworkPage />} />
              <Route path="/network/members/:memberId" element={<MemberProfilePage />} />
              <Route path="/network/groups/:groupId" element={<GroupPage />} />
              <Route path="/forums" element={<ForumsPage />} />
              <Route path="/forums/:threadId" element={<ThreadPage />} />
              <Route path="/sessions/:sessionId" element={<SessionPage />} />
              <Route path="/workshops" element={<EventCollectionPage type="workshops" />} />
              <Route path="/webinars" element={<EventCollectionPage type="webinars" />} />
              <Route path="/publications/blogs/:slug" element={<ContentDetail />} />
              <Route path="/publications/blogs" element={<ContentDirectory kind="article" />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/terms-summary" element={<TermsSummary />} />
              <Route path="/story-preview" element={<StoriesSection />} />
            </Routes>
          </MemoryRouter>
        </ContentContext.Provider>
      </DemoContext.Provider>,
    );
  }
  let count = 0;
  for (const member of state.accounts)
    for (const tab of ['activity', 'blog', 'profile', 'friends', 'groups', 'forums', 'events']) {
      const html = render(`/network/members/${member.id}?tab=${tab}`);
      assert.ok(html.includes(member.name));
      assert.ok(!html.includes('BuddyDrive'));
      assert.ok(!html.includes('Friend requests'));
      count++;
    }
  for (const group of state.groups) {
    assert.ok(render(`/network/groups/${group.id}`).includes(group.name));
    count++;
  }
  for (const session of state.sessions) {
    const html = render(`/sessions/${session.id}`);
    assert.ok(html.includes(session.title.replaceAll('&', '&amp;')));
    if (session.status === 'completed') assert.ok(html.includes('registration closed'));
    count++;
  }
  for (const tab of ['groups', 'members', 'activity', 'leaderboard']) {
    assert.ok(render(`/network?tab=${tab}`).includes('Find your people'));
    count++;
  }
  for (const path of [
    '/forums',
    '/forums/demo-topic-1',
    '/workshops',
    '/webinars',
    '/publications/blogs/demo-blog-customer-learning',
  ]) {
    assert.ok(render(path).length > 1000);
    count++;
  }
  assert.ok(
    render('/network/members/demo-founder?tab=friends', 'demo-founder').includes('Accept request'),
  );
  assert.ok(
    !render('/network/members/demo-founder?tab=friends', 'demo-editor').includes('Accept request'),
  );
  assert.ok(
    render('/network/members/demo-mentee?tab=events', 'demo-mentee').includes(
      'Customer discovery studio',
    ),
  );
  assert.ok(
    !render('/network/members/demo-mentee?tab=events', 'demo-editor').includes(
      'Customer discovery studio',
    ),
  );
  assert.ok(render('/sessions/demo-customer-discovery', 'demo-mentee').includes('Cancel my place'));
  assert.ok(
    !render('/sessions/demo-customer-discovery', 'demo-founder').includes('Your registration:'),
  );
  assert.ok(render('/network/members/missing').includes('404'));
  assert.ok(render('/sessions/missing').includes('404'));
  const reading = render('/publications/blogs/demo-blog-customer-learning');
  const widgetOrder = (html: string) =>
    [...html.matchAll(/<section class="discovery-widget" aria-label="([^"]+)"/g)].map(
      (match) => match[1],
    );
  assert.deepEqual(widgetOrder(reading), [
    'Keep reading',
    'Featured',
    'Comments',
    'Most liked',
    'On the forums',
  ]);
  assert.ok(reading.includes('id="comment-demo-comment-customer"'));
  assert.ok(reading.includes('Reading sidebar'));
  assert.ok(render('/publications/blogs').includes('Reading sidebar'));
  const forums = render('/forums?date=2026-11-01');
  assert.deepEqual(widgetOrder(forums), [
    'Featured courses',
    'Advertisements',
    'Featured',
    'Comments',
    'Calendar',
  ]);
  assert.ok(forums.includes('1 discussion active on 1 November 2026'));
  assert.ok(forums.includes('Show all dates'));
  assert.ok(render('/forums?forum=technology&date=2026-11-01').includes('0 discussions active on'));
  assert.ok(render('/forums?date=not-a-date').includes('How do you validate an idea'));
  assert.ok(render('/forums/demo-topic-1').includes('Forum sidebar'));
  const roster = (html: string) =>
    html.match(/<section class="member-roster"[\s\S]*?<\/section>/)?.[0] ?? '';
  const groupGuest = render('/network/groups/green-founders');
  assert.ok(roster(groupGuest).includes('Members <span>2</span>'));
  assert.ok(!roster(groupGuest).includes('Amani Njeri'));
  assert.ok(!groupGuest.includes('activity-timeline'));
  const groupMember = render('/network/groups/green-founders', 'demo-founder');
  assert.ok(roster(groupMember).includes('Amani Njeri'));
  assert.ok(roster(groupMember).includes('Jordan Otieno'));
  assert.ok(!roster(groupMember).includes('Founder · Demo Green Basket'));
  assert.ok(!roster(groupMember).includes('member-card'));
  assert.ok(groupMember.includes('activity-timeline'));
  assert.ok(!groupMember.includes('Start with their current habits and frustrations.'));
  assert.ok(
    !roster(render('/forums?forum=entrepreneurship', 'demo-editor')).includes('Amani Njeri'),
  );
  assert.ok(
    roster(render('/forums?forum=entrepreneurship', 'demo-mentor')).includes('Amani Njeri'),
  );
  const portraits = render('/story-preview');
  assert.equal(
    [...portraits.matchAll(/data-revealed="false"/g)].length,
    catalog.homepage.featuredStories.length,
  );
  assert.ok(portraits.includes('aria-expanded="false"'));
  assert.ok(portraits.includes('class="story-card-overlay" aria-hidden="true"'));
  const termsPage = render('/terms');
  assert.ok(termsPage.includes('19 August 2026'));
  for (const section of catalog.terms.sections)
    assert.ok(termsPage.includes(section.title.replaceAll('&', '&amp;')));
  for (const point of catalog.terms.summary) assert.ok(render('/terms-summary').includes(point));
  return count + 8;
}
