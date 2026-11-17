import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ContentContext } from '../src/app/useCatalog';
import { DemoContext } from '../src/app/useDemo';
import { DemoCatalogOverlay } from '../src/app/DemoCatalogOverlay';
import { createDemoSeed } from '../src/services/demo-repository';
import { mockContentRepository } from '../src/services/mock-content-repository';
import { createCmsSnapshot } from '../src/services/cms-snapshot';
import { LoginPage } from '../src/features/demo/LoginPage';
import { AccountDialog } from '../src/features/accounts/AccountDialog';
import { accountDestination } from '../src/features/accounts/account-navigation';
import { JoinPage } from '../src/features/connect/JoinPage';
import { AboutPage } from '../src/features/info/AboutPage';
import { ApplicationsPage } from '../src/features/accounts/ApplicationsPage';
import { EventsPage } from '../src/features/benefits/EventsPage';
import { OpportunitiesPage, OpportunityDetail } from '../src/features/benefits/OpportunitiesPage';
import { RoleDashboard } from '../src/features/platform/RoleDashboard';
import { WorkspacePage } from '../src/features/platform/WorkspacePage';
import { OpportunityForm, MilestoneEditor } from '../src/features/platform/WorkspaceEditors';
import { CmsPage } from '../src/features/cms/CmsPage';
import { CmsPreview } from '../src/features/cms/CmsPreview';
import { RequireDemo } from '../src/features/demo/RequireDemo';
import { LearningPage } from '../src/features/resources/LearningPage';
import { useCatalog } from '../src/app/useCatalog';
import { applyDemoAction, type DemoState } from '../src/domain/demo';
import { DashboardLayout } from '../src/features/dashboard/DashboardLayout';
import { DashboardCatalogue } from '../src/features/dashboard/DashboardCatalogue';
import { DashboardEvents } from '../src/features/dashboard/DashboardEvents';
import { ContentDetail } from '../src/features/content/ContentDetail';
import { MarketplacePage } from '../src/features/content/MarketplacePage';
import { DashboardCertificates } from '../src/features/dashboard/DashboardCertificates';
import { ProfilePage } from '../src/features/dashboard/ProfilePage';
import { dashboardAccess } from '../src/features/dashboard/dashboard-navigation';
import {
  dashboardUpdateKeys,
  dashboardUpdates,
} from '../src/features/dashboard/dashboard-notifications';
import { dashboardTitles } from '../src/features/dashboard/dashboard-overview';
import type { ReactNode } from 'react';

export async function checkPlatformRendering() {
  const state = createDemoSeed();
  const catalog = await mockContentRepository.loadCatalog();
  const snapshot = createCmsSnapshot(catalog, state);
  function render(
    path: string,
    id: string | null = null,
    child?: ReactNode,
    custom: DemoState = state,
    enabled = true,
  ) {
    const account = custom.accounts.find((a) => a.id === id) ?? null;
    return renderToStaticMarkup(
      <ContentContext.Provider value={catalog}>
        <DemoContext.Provider
          value={{
            state: { ...custom, activeAccountId: id },
            account,
            enabled,
            error: '',
            execute: () => false,
            reset: () => {},
            clearError: () => {},
          }}
        >
          <MemoryRouter initialEntries={[path]}>
            {child ?? (
              <Routes>
                <Route path="/demo" element={<LoginPage />} />
                <Route path="/join" element={<JoinPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/apply" element={<ApplicationsPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/marketplace/:slug" element={<ContentDetail />} />
                <Route path="/opportunities" element={<OpportunitiesPage />} />
                <Route path="/opportunities/:slug" element={<OpportunityDetail />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireDemo>
                      <DashboardLayout />
                    </RequireDemo>
                  }
                >
                  <Route index element={<RoleDashboard />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="learning" element={<DashboardCatalogue kind="learning" />} />
                  <Route path="events" element={<DashboardEvents />} />
                  <Route path="marketplace" element={<DashboardCatalogue kind="marketplace" />} />
                  <Route path="marketplace/:slug" element={<ContentDetail dashboard />} />
                  <Route path="certificates" element={<DashboardCertificates />} />
                  <Route path="workspace" element={<WorkspacePage />} />
                  <Route
                    path="cms"
                    element={
                      <RequireDemo capabilities={dashboardAccess.cms}>
                        <CmsPage />
                      </RequireDemo>
                    }
                  />
                </Route>
                <Route path="/learn/:courseId" element={<LearningPage />} />
              </Routes>
            )}
          </MemoryRouter>
        </DemoContext.Provider>
      </ContentContext.Provider>,
    );
  }
  let count = 0;
  for (const path of [
    '/join',
    '/apply',
    '/events',
    '/events?date=2026-11-20',
    '/opportunities',
    '/opportunities?status=closed',
    '/opportunities?status=upcoming',
  ]) {
    assert.ok(render(path).length > 400, path);
    count++;
  }
  // Feature every matching CMS-selected listing once, never promote an unselected one.
  const featuredState = structuredClone(state);
  featuredState.platform.opportunities = featuredState.platform.opportunities.map((o) => ({
    ...o,
    featured: true,
  }));
  featuredState.platform.opportunities.push({
    ...featuredState.platform.opportunities[0]!,
    id: 'hidden-featured-draft',
    slug: 'hidden-featured-draft',
    title: 'Hidden featured draft',
    status: 'draft',
  });
  const featuredHtml = render('/opportunities', null, undefined, featuredState);
  assert.ok(featuredHtml.includes('Featured opportunities'));
  assert.equal((featuredHtml.match(/class="benefit-card /g) ?? []).length, 2);
  assert.equal((featuredHtml.match(/benefit-featured/g) ?? []).length, 2);
  assert.ok(!featuredHtml.includes('Hidden featured draft'));
  assert.ok(!featuredHtml.includes('Youth innovation pitch challenge'));
  assert.ok(!featuredHtml.includes('More opportunities'));
  const filteredHtml = render('/opportunities?category=Grant', null, undefined, featuredState);
  assert.equal((filteredHtml.match(/class="benefit-card /g) ?? []).length, 1);
  assert.ok(!filteredHtml.includes('Market access and technical support'));
  const unfeaturedState = structuredClone(state);
  unfeaturedState.platform.opportunities.forEach((o) => (o.featured = false));
  const unfeaturedHtml = render('/opportunities', null, undefined, unfeaturedState);
  assert.ok(!unfeaturedHtml.includes('Featured opportunities'));
  assert.ok(unfeaturedHtml.includes('All opportunities'));
  const emptyHtml = render('/opportunities?q=no-such-opportunity', null, undefined, featuredState);
  assert.ok(emptyHtml.includes('No opportunities match these filters.'));
  assert.ok(!emptyHtml.includes('Featured opportunities'));
  const mixedHtml = render('/opportunities');
  assert.ok(mixedHtml.includes('More opportunities'));
  assert.equal((mixedHtml.match(/class="benefit-card /g) ?? []).length, 2);
  count += 5;
  function renderAccount(mode: 'login' | 'register', enabled = true) {
    return render(
      '/',
      null,
      <AccountDialog mode={mode} search="" onClose={() => {}} />,
      state,
      enabled,
    );
  }
  const login = renderAccount('login');
  const register = renderAccount('register');
  const demo = render('/demo');
  assert.ok(login.includes('id="account-title">Sign in</h2>'));
  assert.ok(login.includes('Access your workspace.'));
  assert.ok(login.includes('<dialog class="account-dialog"'));
  assert.ok(login.includes('Close account dialog'));
  assert.ok(login.includes('name="email"'));
  assert.ok(login.includes('Create an account'));
  assert.ok(login.includes('Continue with Google'));
  assert.ok(login.includes('href="/demo"'));
  assert.ok(!login.includes('demo-account-grid'));
  assert.ok(register.includes('Create your account'));
  for (const field of ['name', 'email', 'location', 'terms'])
    assert.ok(register.includes(`name="${field}"`), field);
  assert.ok(register.includes('Already have an account?'));
  assert.ok(register.includes('Continue with Google'));
  assert.ok(register.includes('href="/demo"'));
  assert.ok(demo.includes('demo-account-grid'));
  for (const role of [
    'Guest',
    'Youth Entrepreneur / Learner',
    'Mentor',
    'Partner',
    'Investor',
    'Content Manager',
    'Platform Administrator',
  ])
    assert.ok(demo.includes(`Login as ${role}`), role);
  assert.ok(render('/join').includes('pathway-options'));
  const team = catalog.team;
  assert.ok(team);
  const about = render('/about#our-team');
  assert.ok(about.includes('id="our-team"'));
  assert.ok(about.includes(team.groupPhoto.image));
  assert.equal((about.match(/aria-haspopup="dialog"/g) ?? []).length, team.members.length);
  for (const member of team.members) assert.ok(about.includes(`View profile for ${member.name}`));
  for (const mode of ['login', 'register'] as const) {
    const production = renderAccount(mode, false);
    assert.ok(production.includes('Continue with Google'));
    assert.ok(!production.includes('name="email"'));
    assert.ok(!production.includes('href="/demo"'));
  }
  assert.equal(
    accountDestination('?redirect=%2Fopportunities%3Fstatus%3Dall%23results', '/dashboard'),
    '/opportunities?status=all#results',
  );
  for (const target of [
    'https://example.test',
    '//example.test',
    '/\\example.test',
    '/_/..//example.test',
    '/login',
    '/register',
    '/demo',
  ])
    assert.equal(
      accountDestination(`?redirect=${encodeURIComponent(target)}`, '/dashboard'),
      '/dashboard',
      target,
    );
  assert.ok(render('/apply').includes('Sign in before applying'));
  assert.ok(!render('/apply', 'demo-guest').includes('<option value="admin">'));
  assert.ok(render('/dashboard/cms', 'demo-guest').includes('different role'));
  assert.ok(render('/dashboard/cms', 'demo-founder').includes('different role'));
  for (const account of state.accounts) {
    const html = render('/dashboard', account.id);
    assert.ok(html.includes(account.name.split(' ')[0]!));
    assert.ok(html.includes(dashboardTitles[account.role]));
    assert.ok(html.includes('aria-controls="dashboard-menu"'));
    assert.ok(html.includes('aria-controls="feiso-mobile-drawer"'));
    assert.ok(html.includes('aria-label="Open site menu"'));
    assert.match(html, /aria-label="Notifications[,"]/);
    assert.ok(!html.includes('aria-label="Search the hub"'));
    assert.ok(html.includes('aria-label="Dashboard navigation"'));
    count++;
  }
  assert.ok(!render('/dashboard', 'demo-guest').includes('/dashboard/cms'));
  const guestDashboard = render('/dashboard', 'demo-guest');
  for (const link of [
    '/dashboard/learning',
    '/dashboard/events',
    '/dashboard/marketplace',
    '/dashboard/certificates',
    '/dashboard/profile',
  ])
    assert.ok(guestDashboard.includes(`href="${link}"`));
  assert.ok(!guestDashboard.includes('href="/dashboard/applications"'));
  const guestProfile = render('/dashboard/profile', 'demo-guest');
  assert.ok(guestProfile.includes('Submit application'));
  assert.ok(!guestProfile.includes('Submit role change request'));
  assert.ok(!guestProfile.includes('Save changes'));
  assert.ok(render('/dashboard/profile', 'demo-founder').includes('Submit role change request'));
  const coursesInDashboard = render('/dashboard/learning?category=Getting+started', 'demo-guest');
  assert.ok(
    coursesInDashboard.includes(
      '/dashboard/learning/business-foundations?category=Getting+started',
    ),
  );
  assert.ok(!coursesInDashboard.includes('/dashboard/learning/growing-your-business'));
  const futureStart = new Date(Date.now() + 86_400_000).toISOString();
  const futureEnd = new Date(Date.now() + 90_000_000).toISOString();
  const eventState = {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === 'demo-customer-discovery'
        ? { ...session, startsAt: futureStart, endsAt: futureEnd }
        : session,
    ),
  };
  const dashboardEvents = render(
    '/dashboard/events?category=Workshops',
    'demo-guest',
    undefined,
    eventState,
  );
  assert.ok(!dashboardEvents.includes('dashboard-events-title'));
  assert.ok(
    dashboardEvents.includes('/dashboard/events/demo-customer-discovery?category=Workshops'),
  );
  assert.ok(!dashboardEvents.includes('/dashboard/events/demo-digital-launch'));
  assert.ok(dashboardEvents.includes('Past events archive'));
  assert.ok(!dashboardEvents.includes('Innovation and Entrepreneurship Bootcamp'));
  const archive = render('/dashboard/events?view=past', 'demo-guest');
  assert.ok(archive.includes('Innovation and Entrepreneurship Bootcamp'));
  const myEvents = render('/dashboard/events?view=mine', 'demo-mentee', undefined, eventState);
  assert.ok(myEvents.includes('Upcoming &amp; ongoing'));
  assert.ok(myEvents.includes('Customer discovery studio'));
  assert.ok(myEvents.includes('You have no past bookings yet.'));
  assert.ok(!myEvents.includes('Innovation and Entrepreneurship Bootcamp'));
  const pastBookings = render('/dashboard/events?view=mine', 'demo-mentee', undefined, {
    ...eventState,
    registrations: eventState.registrations.map((registration) =>
      registration.sessionId === 'demo-customer-discovery' &&
      registration.memberId === 'demo-mentee'
        ? { ...registration, status: 'attended' }
        : registration,
    ),
  });
  assert.ok(
    pastBookings.indexOf('Past events') < pastBookings.indexOf('Customer discovery studio'),
  );
  assert.ok(pastBookings.includes('Attended'));
  const dashboardMarket = render('/dashboard/marketplace?category=Agribusiness', 'demo-guest');
  assert.ok(
    dashboardMarket.includes(
      '/dashboard/marketplace/comfort-worms-and-insects?category=Agribusiness',
    ),
  );
  assert.ok(!dashboardMarket.includes('/dashboard/marketplace/joyride-medical-center'));
  assert.ok(!dashboardMarket.includes('page-intro'));
  const marketListing = render('/dashboard/marketplace/comfort-worms-and-insects', 'demo-guest');
  assert.ok(marketListing.includes('Back to Marketplace'));
  assert.ok(!marketListing.includes('discovery-sidebar'));
  assert.ok(!marketListing.includes('Keep exploring'));
  const publicMarketplace = render('/marketplace');
  assert.ok(publicMarketplace.includes('aria-label="Marketplace sectors"'));
  assert.ok(!publicMarketplace.includes('Browse by sector'));
  assert.ok(publicMarketplace.includes('href="/marketplace?category=Healthcare"'));
  assert.ok(publicMarketplace.includes('aria-label="Advertisements"'));
  assert.ok(!publicMarketplace.includes('href="/marketplace/joyride-medical-center"'));
  const publicSector = render('/marketplace?category=Healthcare');
  assert.ok(publicSector.includes('href="/marketplace/joyride-medical-center"'));
  assert.ok(!publicSector.includes('href="/marketplace/comfort-worms-and-insects"'));
  assert.ok(publicSector.includes('Explore other sectors'));
  assert.ok(publicSector.includes('href="/marketplace?category=Agribusiness"'));
  const publicListing = render('/marketplace/joyride-medical-center');
  assert.ok(publicListing.includes('href="/marketplace?category=Healthcare"'));
  assert.ok(publicListing.includes('aria-label="Advertisements"'));
  assert.ok(render('/dashboard/certificates', 'demo-guest').includes('No certificates yet'));
  assert.ok(!render('/dashboard', 'demo-mentor').includes('tab=approvals'));
  const mentorDashboard = render('/dashboard', 'demo-mentor');
  assert.ok(mentorDashboard.includes('aria-label="Notifications, 1 update"'));
  assert.ok(mentorDashboard.includes('Mentorship requests to review'));
  assert.ok(!mentorDashboard.includes('Pending connection requests'));
  const mentor = state.accounts.find(({ id }) => id === 'demo-mentor')!;
  const readKeys = new Set(dashboardUpdateKeys(dashboardUpdates(state, mentor)));
  const replacement = {
    ...state,
    requests: state.requests.map((request) => ({ ...request, id: `new-${request.id}` })),
  };
  const newKeys = dashboardUpdateKeys(dashboardUpdates(replacement, mentor));
  assert.equal(newKeys.length, readKeys.size);
  assert.equal(newKeys.filter((key) => !readKeys.has(key)).length, 1);
  const founderDashboard = render('/dashboard', 'demo-founder');
  assert.ok(founderDashboard.includes('Pending connection requests'));
  assert.ok(!founderDashboard.includes('Mentorship requests to review'));
  assert.ok(render('/dashboard', 'demo-partner').includes('Partner tools'));
  assert.ok(render('/dashboard', 'demo-investor').includes('Investor tools'));
  const teamEditor = render('/dashboard/cms?module=team', 'demo-editor');
  assert.ok(teamEditor.includes('Members <small>8 entries'));
  assert.match(
    teamEditor,
    /<a(?=[^>]*href="\/dashboard\/cms\?module=team")(?=[^>]*aria-current="page")[^>]*>/,
  );

  const now = '2026-11-16T10:00:00Z';
  const memberId = 'member-dashboard-test';
  const joined = applyDemoAction(state, {
    type: 'signup',
    id: memberId,
    name: 'Dashboard Tester',
    email: 'dash@example.test',
    location: 'Nairobi',
    phone: '',
    ageRange: '',
    consent: true,
    now,
  });
  const pending = applyDemoAction(joined, {
    type: 'role-apply',
    id: 'test-role',
    role: 'mentor',
    motivation: 'Apply to guide entrepreneurs in developing viable ideas.',
    organisation: '',
    expertise: 'Business operations',
    now,
  });
  const pendingOverview = render('/dashboard', memberId, undefined, pending);
  assert.ok(pendingOverview.includes('Application under review'));
  assert.ok(!pendingOverview.includes('tab=mentees'));
  const admin = applyDemoAction(pending, { type: 'login', accountId: 'demo-admin' });
  assert.ok(
    render('/dashboard', 'demo-admin', undefined, admin).includes('Items awaiting approval'),
  );
  const approved = applyDemoAction(admin, {
    type: 'role-review',
    id: 'test-role',
    decision: 'approved',
    reason: 'Approved for the mentoring programme.',
    now,
  });
  const approvedOverview = render('/dashboard', memberId, undefined, approved);
  assert.ok(approvedOverview.includes('Mentor dashboard'));
  assert.ok(approvedOverview.includes('tab=mentees'));
  assert.ok(approvedOverview.includes('Approved for the mentoring programme.'));
  assert.ok(approvedOverview.includes('Role request decisions'));
  assert.ok(approvedOverview.includes('/dashboard/profile#role-access'));
  const approvedMember = approved.accounts.find((account) => account.id === memberId)!;
  assert.ok(
    dashboardUpdateKeys(dashboardUpdates(approved, approvedMember)).includes(
      '/dashboard/applications:test-role:approved',
    ),
  );

  assert.ok(!render('/dashboard', 'demo-partner').includes('Administration'));
  for (const [id, tabs] of [
    ['demo-founder', ['ventures', 'products', 'incubation', 'applications']],
    ['demo-mentor', ['mentor', 'mentees']],
    ['demo-partner', ['organisation', 'opportunities', 'applicants', 'discovery']],
    ['demo-investor', ['organisation', 'opportunities']],
    ['demo-admin', ['approvals', 'users', 'certificates', 'reports']],
  ] as const) {
    for (const tab of tabs) {
      assert.ok(render(`/dashboard/workspace?tab=${tab}`, id).length > 1000);
      count++;
    }
  }
  for (const id of ['demo-editor', 'demo-admin']) {
    assert.ok(render('/dashboard/cms', id).includes('YERH CONTENT STUDIO'));
    count++;
  }
  for (const o of state.platform.opportunities) {
    assert.ok(render(`/opportunities/${o.slug}`).includes(o.title));
    count++;
  }
  assert.ok(
    render('/opportunities/demo-seed-grant', 'demo-guest').includes(
      'Apply for entrepreneur access',
    ),
  );
  assert.ok(
    !render('/dashboard/workspace?tab=applicants', 'demo-guest').includes('Opportunity applicants'),
  );
  for (const module of [
    'site',
    'terms',
    'media',
    'courses',
    'lessons',
    'topics',
    'faqs',
    'sessions',
    'opportunities',
    'community',
    'sidebar',
  ]) {
    assert.ok(
      render(
        '/preview',
        'demo-editor',
        <CmsPreview module={module} snapshot={snapshot} selected={0} />,
      ).length > 100,
    );
    count++;
  }
  assert.ok(
    render(
      '/editor',
      'demo-partner',
      <OpportunityForm
        ownerId="demo-partner"
        organiser="Demo"
        image={catalog.media.business}
        onSave={() => false}
      />,
    ).includes('External application'),
  );
  assert.ok(
    render(
      '/milestone',
      'demo-mentor',
      <MilestoneEditor
        incubationId="test"
        milestone={{
          id: 'one',
          title: 'Customer interviews',
          note: 'Review the interview evidence.',
          validated: false,
        }}
        onSave={() => false}
      />,
    ).includes('Update milestone'),
  );
  // Archiving retains an editorial record for restoration but removes it from public catalogues.
  const archived = structuredClone(snapshot);
  archived.catalog.items[0]!.status = 'archived';
  const changed = structuredClone(state);
  changed.platform.cmsReleases.push({
    id: 'one',
    revision: 1,
    actorId: 'demo-editor',
    title: 'Archive',
    snapshot: archived,
    createdAt: '2026-11-10T09:00:00Z',
  });
  changed.platform.cmsRevision = 1;
  function CatalogProbe() {
    const c = useCatalog();
    return (
      <p>
        {c.items.some((i) => i.id === archived.catalog.items[0]!.id) ? 'VISIBLE' : 'HIDDEN'}:
        {c.items.filter((i) => i.id === 'demo-venture-green').length}
      </p>
    );
  }
  assert.ok(
    render(
      '/probe',
      null,
      <DemoCatalogOverlay>
        <CatalogProbe />
      </DemoCatalogOverlay>,
      changed,
    ).includes('HIDDEN:1'),
  );
  assert.equal(createCmsSnapshot(catalog, changed).catalog.items[0]?.status, 'archived');
  return count;
}
