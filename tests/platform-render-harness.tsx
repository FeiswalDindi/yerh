import assert from 'node:assert/strict';
import { renderToReadableStream, renderToStaticMarkup } from 'react-dom/server';
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
import { CertificatePage } from '../src/features/platform/CertificatePage';
import { StoriesSection } from '../src/features/home/StoriesSection';
import { UpcomingEventsSection } from '../src/features/home/UpcomingEventsSection';
import { SessionPage } from '../src/features/resources/SessionPage';
import { ProfilePage } from '../src/features/dashboard/ProfilePage';
import { dashboardAccess } from '../src/features/dashboard/dashboard-navigation';
import {
  dashboardBadges,
  dashboardUpdateKeys,
  dashboardUpdates,
  updatesForDestination,
} from '../src/features/dashboard/dashboard-notifications';
import { dashboardTitles } from '../src/features/dashboard/dashboard-overview';
import type { ReactNode } from 'react';

export async function checkPlatformRendering() {
  const state = createDemoSeed();
  const catalog = await mockContentRepository.loadCatalog();
  const snapshot = createCmsSnapshot(catalog, state);
  function page(
    path: string,
    id: string | null = null,
    child?: ReactNode,
    custom: DemoState = state,
    enabled = true,
  ) {
    const account = custom.accounts.find((a) => a.id === id) ?? null;
    return (
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
              <DemoCatalogOverlay>
                <Routes>
                  <Route path="/" element={<StoriesSection />} />
                  <Route path="/demo" element={<LoginPage />} />
                  <Route path="/join" element={<JoinPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/apply" element={<ApplicationsPage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/sessions/:sessionId" element={<SessionPage />} />
                  <Route path="/marketplace" element={<MarketplacePage />} />
                  <Route path="/marketplace/:slug" element={<ContentDetail />} />
                  <Route path="/certificates/:id" element={<CertificatePage />} />
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
              </DemoCatalogOverlay>
            )}
          </MemoryRouter>
        </DemoContext.Provider>
      </ContentContext.Provider>
    );
  }
  const render = (...args: Parameters<typeof page>) => renderToStaticMarkup(page(...args));
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
  assert.ok(login.includes('id="account-title">Select your institution</h2>'));
  assert.ok(login.includes('institution-sign-in.webp'));
  assert.ok(login.includes('<dialog class="account-dialog account-institution-dialog"'));
  assert.ok(login.includes('Close account dialog'));
  assert.ok(login.includes('value="yerh"'));
  assert.ok(login.includes('Lakeview Demo High School'));
  assert.ok(!login.includes('name="email"'));
  assert.ok(!login.includes('demo-account-grid'));
  assert.ok(register.includes('Create your account'));
  for (const field of ['name', 'email', 'location', 'terms', 'institution'])
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
    assert.ok(
      production.includes(mode === 'login' ? 'Select your institution' : 'Continue with Google'),
    );
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
  assert.ok(!pastBookings.includes('Attended'));
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
  assert.ok(pendingOverview.includes('Requested role'));
  assert.ok(!pendingOverview.includes('tab=mentees'));
  const admin = applyDemoAction(pending, { type: 'login', accountId: 'demo-admin' });
  const adminDashboard = render('/dashboard', 'demo-admin', undefined, admin);
  assert.ok(adminDashboard.includes('Role requests to review'));
  assert.match(adminDashboard, /Approval queue<span class="dashboard-nav-badge"/);
  assert.ok(!adminDashboard.includes('href="/dashboard/certificates"'));
  const operator = admin.accounts.find((account) => account.id === 'demo-admin')!;
  const adminUpdates = dashboardUpdates(admin, operator);
  const approvalHref = '/dashboard/workspace?tab=approvals';
  const roles = updatesForDestination(adminUpdates, approvalHref + '&view=roles');
  const roleKeys = dashboardUpdateKeys(roles);
  assert.ok(roleKeys.length > 0);
  assert.ok(
    !dashboardUpdateKeys(updatesForDestination(adminUpdates, approvalHref)).some((key) =>
      roleKeys.includes(key),
    ),
  );
  assert.equal(
    dashboardBadges(adminUpdates, new Set(roleKeys)).get(approvalHref),
    (dashboardBadges(adminUpdates, new Set()).get(approvalHref) ?? 0) - roleKeys.length,
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
  for (const [id, tab, expected] of [
    ['demo-founder', 'ventures', 'Add venture'],
    ['demo-founder', 'products', 'Add product'],
    ['demo-mentor', 'course-proposals', 'Propose a course'],
    ['demo-admin', 'admin-courses', 'Course catalogue'],
  ] as const) {
    const stream = await renderToReadableStream(page(`/dashboard/workspace?tab=${tab}`, id));
    await stream.allReady;
    assert.ok((await new Response(stream).text()).includes(expected));
    count++;
  }
  for (const [id, tabs] of [
    ['demo-founder', ['ventures', 'products', 'incubation', 'applications']],
    ['demo-mentor', ['mentor', 'mentees']],
    ['demo-partner', ['organisation', 'opportunities', 'applicants', 'discovery']],
    ['demo-investor', ['organisation', 'opportunities']],
    [
      'demo-admin',
      [
        'approvals',
        'users',
        'certificates',
        'reports',
        'payments',
        'institutions',
        'manage-ventures',
        'manage-products',
      ],
    ],
    ['demo-school', ['school', 'member-results', 'ventures', 'products', 'incubation']],
  ] as const) {
    for (const tab of tabs) {
      assert.ok(render(`/dashboard/workspace?tab=${tab}`, id).length > 1000);
      count++;
    }
  }
  const trainingPreview = structuredClone(state);
  assert.ok(render('/dashboard/learning', 'demo-founder').includes('Incubation Pathway'));
  assert.ok(render('/dashboard/learning', 'demo-founder').includes('General Courses'));
  assert.ok(render('/learn/business-foundations', 'demo-founder').includes('Pay upfront'));
  assert.ok(!render('/learn/business-foundations', 'demo-mentor').includes('Watch original video'));
  const submittedListing = applyDemoAction(
    { ...state, activeAccountId: 'demo-founder' },
    {
      type: 'product-save',
      now: '2026-11-10T09:00:00Z',
      product: {
        id: 'submitted-listing',
        ventureId: 'demo-venture-green',
        ownerId: 'demo-founder',
        name: 'Demo seedling starter kit',
        description: 'A collection of pots and seeds for new home growers.',
        price: 120,
        status: 'pending',
      },
    },
  );
  const launchedVenture = applyDemoAction(submittedListing, {
    type: 'incubation-apply',
    now: '2026-11-10T09:01:00Z',
    id: 'seedling-incubation',
    ventureId: 'demo-venture-green',
    goal: 'Validate the product with prospective home growers.',
    productIds: ['submitted-listing'],
  });
  const approvals = render(
    '/dashboard/workspace?tab=approvals',
    'demo-admin',
    undefined,
    launchedVenture,
  );
  assert.ok(approvals.includes('Product listings'));
  assert.ok(approvals.includes('Review listing'));
  assert.ok(approvals.includes('Demo seedling starter kit'));
  assert.ok(!approvals.includes('Review application'));
  const incubationApprovals = render(
    '/dashboard/workspace?tab=approvals&view=incubation',
    'demo-admin',
    undefined,
    launchedVenture,
  );
  assert.ok(incubationApprovals.includes('Review application'));
  assert.ok(incubationApprovals.includes('Demo seedling starter kit'));
  assert.ok(!incubationApprovals.includes('Review listing'));
  const founderCertificatePreview = structuredClone(launchedVenture);
  founderCertificatePreview.platform.training.credentials.push({
    id: 'founder-stage-certificate',
    incubationId: 'seedling-incubation',
    learnerId: 'demo-founder',
    kind: 'getting-started',
    issuedAt: now,
    issuedBy: 'demo-admin',
  });
  const founderCertificate = render(
    '/certificates/founder-stage-certificate',
    'demo-founder',
    undefined,
    founderCertificatePreview,
  );
  assert.ok(founderCertificate.includes('Achievements'));
  assert.ok(founderCertificate.includes('Customer discovery'));
  assert.ok(!founderCertificate.includes('Classification'));
  const submittedVenture = applyDemoAction(
    { ...state, activeAccountId: 'demo-school' },
    {
      type: 'venture-save',
      now: '2026-11-10T09:02:00Z',
      venture: {
        id: 'submitted-school-venture',
        ownerId: 'demo-school',
        groupId: 'demo-school-group',
        name: 'School garden project',
        description: 'The student team grows seedlings for nearby home gardens.',
        sector: 'Agriculture',
        stage: 'Pilot',
        location: 'Nairobi',
        status: 'pending',
      },
    },
  );
  const ventureApprovals = render(
    '/dashboard/workspace?tab=approvals&view=ventures',
    'demo-admin',
    undefined,
    submittedVenture,
  );
  assert.ok(!ventureApprovals.includes('School garden project'));
  const founderProducts = render(
    '/dashboard/workspace?tab=products&product=' +
      submittedListing.platform.products.find(
        (product) => product.name === 'Demo seedling starter kit',
      )!.id,
    'demo-founder',
    undefined,
    submittedListing,
  );
  assert.ok(founderProducts.includes('Switch demo role to review'));
  const reviewLink = founderProducts.match(/href="(\/demo\?redirect=[^"]+)"/)?.[1];
  assert.ok(reviewLink);
  const destination = accountDestination(
    new URL(reviewLink, 'http://127.0.0.1').search,
    '/dashboard',
  );
  assert.equal(destination, '/dashboard/workspace?tab=approvals');
  const sameBrowserAdmin = applyDemoAction(submittedListing, {
    type: 'login',
    accountId: 'demo-admin',
  });
  assert.ok(
    render(destination, 'demo-admin', undefined, sameBrowserAdmin).includes(
      'Demo seedling starter kit',
    ),
  );
  trainingPreview.platform.products.push({
    id: 'test-listing',
    ventureId: 'demo-venture-green',
    ownerId: 'demo-founder',
    name: 'Fictional pending publication',
    description: 'Test that moderation alone does not publish this product.',
    price: 120,
    status: 'approved',
  });
  const listing = '/marketplace/product-test-listing';
  assert.ok(
    !render(listing, null, undefined, trainingPreview).includes('Fictional pending publication'),
  );
  assert.ok(
    render(
      '/dashboard/workspace?tab=products',
      'demo-founder',
      undefined,
      trainingPreview,
    ).includes('View product'),
  );
  assert.ok(
    !render('/dashboard/workspace?tab=payments&view=settings', 'demo-founder').includes(
      'Edit payment settings',
    ),
  );
  trainingPreview.platform.training.payments.push({
    id: 'test-payment',
    accountId: 'demo-founder',
    purpose: 'marketplace',
    targetId: 'test-listing',
    status: 'confirmed',
    amount: 1000,
    submittedAt: '2026-11-10T09:00:00Z',
  });
  assert.ok(
    render(listing, null, undefined, trainingPreview).includes('Fictional pending publication'),
  );
  const school = trainingPreview.platform.training.institutions.find(
    (row) => row.id === 'demo-high-school',
  )!;
  school.featured = true;
  school.story = 'An institution success story with only school-level results.';
  assert.ok(render('/', null, undefined, trainingPreview).includes(school.name));
  assert.ok(!render('/', null, undefined, trainingPreview).includes('Robin Kimani'));
  assert.ok(
    render(
      '/dashboard/workspace?tab=school&view=students&student=demo-student-a',
      'demo-school',
    ).includes('Professional profile draft'),
  );
  assert.ok(
    !render('/dashboard/workspace?tab=school', 'demo-university-staff').includes('Robin Kimani'),
  );
  assert.ok(render('/dashboard/profile', 'demo-guest').includes('Lakeside Demo University'));
  const teamPreview = structuredClone(trainingPreview);
  teamPreview.platform.ventures.push({
    ...teamPreview.platform.ventures[0]!,
    id: 'test-school-venture',
    ownerId: 'demo-school',
    groupId: 'demo-school-group',
    name: 'Class enterprise',
    status: 'approved',
  });
  teamPreview.platform.incubations.push({
    id: 'test-school-path',
    ownerId: 'demo-school',
    ventureId: 'test-school-venture',
    goal: 'Run a school enterprise.',
    mentorId: 'demo-mentor',
    status: 'active',
    milestones: [],
  });
  teamPreview.platform.training.stages.push({
    id: 'test-school-path:getting-started',
    incubationId: 'test-school-path',
    stage: 'getting-started',
    steps: [],
    reviewRequestedAt: now,
    meetingAt: now,
    meetingNote: 'Ready',
    examOpenedAt: now,
    attempts: ['demo-student-a', 'demo-student-b'].map((learnerId, i) => ({
      id: learnerId + '-attempt',
      learnerId,
      recordedBy: 'demo-school',
      submittedAt: now,
      answer: '',
      score: i === 0 ? 75 : 45,
      note: 'Offline assessment',
    })),
  });
  teamPreview.platform.training.stages.push({
    id: 'test-school-path:advanced',
    incubationId: 'test-school-path',
    stage: 'advanced',
    steps: [],
    reviewRequestedAt: '',
    meetingAt: '',
    meetingNote: '',
    examOpenedAt: now,
    attempts: [],
  });
  teamPreview.platform.training.credentials.push({
    id: 'test-issued',
    incubationId: 'test-school-path',
    learnerId: 'demo-student-a',
    kind: 'getting-started',
    issuedAt: now,
    issuedBy: 'demo-admin',
  });
  teamPreview.platform.products.push({
    id: 'school-toolkit',
    ventureId: 'test-school-venture',
    ownerId: 'demo-school',
    name: 'Classroom toolkit',
    description: 'Toolkit produced by school team members.',
    status: 'pending',
    price: 500,
  });
  teamPreview.platform.training.cohorts = [
    {
      id: 'term-one',
      institutionId: school.id,
      name: 'Term 1',
      startsOn: '2026-01-10',
      endsOn: '2026-04-10',
      incubationIds: ['test-school-path'],
    },
  ];
  assert.ok(
    render(
      '/dashboard/workspace?tab=member-results',
      'demo-school',
      undefined,
      teamPreview,
    ).includes('Term 1'),
  );
  const schoolPathway = render(
    '/dashboard/workspace?tab=incubation&path=test-school-path',
    'demo-school',
    undefined,
    teamPreview,
  );
  assert.ok(!schoolPathway.includes('Individual contributions'));
  assert.ok(schoolPathway.includes('Record marks'));
  assert.ok(!schoolPathway.includes('Jordan Otieno'));
  assert.ok(!schoolPathway.includes('Mentor meeting'));
  const schoolProduct = render(
    '/dashboard/workspace?tab=products&product=school-toolkit',
    'demo-school',
    undefined,
    teamPreview,
  );
  assert.ok(schoolProduct.includes('Classroom toolkit'));
  assert.ok(!schoolProduct.includes('Record paid listing'));
  assert.ok(
    !render('/dashboard/workspace?tab=approvals', 'demo-admin', undefined, teamPreview).includes(
      'Classroom toolkit',
    ),
  );
  const certs = render(
    '/dashboard/workspace?tab=member-results&cohort=term-one&view=certificates',
    'demo-school',
    undefined,
    teamPreview,
  );
  assert.ok(certs.includes('/certificates/test-issued'));
  assert.ok(certs.includes('Download HTML'));
  assert.ok(certs.includes('First Class'));
  assert.ok(certs.includes('Request certificate'));
  assert.ok(certs.includes('Completion'));
  const printedCertificate = render(
    '/certificates/test-issued',
    'demo-school',
    undefined,
    teamPreview,
  );
  assert.ok(printedCertificate.includes('First Class'));
  assert.ok(!certs.includes('pass rate'));
  const teamResults = render(
    '/dashboard/workspace?tab=member-results&cohort=all',
    'demo-school',
    undefined,
    teamPreview,
  );
  assert.match(
    teamResults,
    /<a(?=[^>]*href="\/dashboard\/workspace\?tab=member-results(?:&amp;cohort=all)?")(?=[^>]*aria-current="page")[^>]*>Results &amp; Certificates(?:<span[^>]*>[^<]*<\/span>)*<\/a>/,
  );
  assert.ok(teamResults.includes('Class enterprise'));
  assert.ok(teamResults.includes('View results'));
  assert.ok(teamResults.includes('Export results CSV'));
  assert.ok(teamResults.includes('Add result'));
  const schoolDirectory = render(
    '/dashboard/workspace?tab=school&view=assessments',
    'demo-school',
    undefined,
    teamPreview,
  );
  assert.ok(schoolDirectory.includes('Record marks'));
  assert.ok(!schoolDirectory.includes('workspace-page-intro'));
  const institutionalVentures = render(
    '/dashboard/workspace?tab=manage-ventures&view=institutions',
    'demo-admin',
    undefined,
    teamPreview,
  );
  assert.match(institutionalVentures, /Class enterprise[\s\S]*?Lakeview Demo High School/);
  const adminEvents = render('/dashboard/events', 'demo-admin');
  assert.ok(adminEvents.includes('Add event'));
  assert.ok(adminEvents.includes('Categories'));
  assert.ok(
    render('/dashboard/events?eventView=preview', 'demo-admin').includes('Event catalogue'),
  );
  const eventPreview = structuredClone(state);
  const year = new Date().getUTCFullYear() + 1;
  const privateEvent = {
    ...eventPreview.sessions[0]!,
    id: 'offline-draft-test',
    title: 'Private entrepreneurship drafting session',
    publication: 'draft' as const,
    startsAt: `${year}-03-12T09:00:00+03:00`,
    endsAt: `${year}-03-12T10:00:00+03:00`,
  };
  eventPreview.sessions.push(privateEvent);
  assert.ok(
    render('/dashboard/events', 'demo-admin', undefined, eventPreview).includes(privateEvent.title),
  );
  assert.ok(
    !render('/dashboard/events?eventView=preview', 'demo-admin', undefined, eventPreview).includes(
      privateEvent.title,
    ),
  );
  const eventDateUrl = `/events?date=${year}-03-12`;
  assert.ok(!render(eventDateUrl, null, undefined, eventPreview).includes(privateEvent.title));
  assert.ok(
    !render('/sessions/' + privateEvent.id, null, undefined, eventPreview).includes(
      privateEvent.title,
    ),
  );
  assert.ok(
    !render('/', null, <UpcomingEventsSection />, eventPreview).includes(privateEvent.title),
  );
  eventPreview.sessions[eventPreview.sessions.length - 1] = {
    ...privateEvent,
    publication: 'published',
  };
  eventPreview.sessions[eventPreview.sessions.length - 1]!.presenters = [
    {
      id: 'presenter-check',
      role: 'facilitator',
      name: 'Ruth Demo',
      profession: 'Enterprise Trainer',
      photo:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
    },
  ];
  eventPreview.sessions[eventPreview.sessions.length - 1]!.hostIds = [];
  const publicEvent = render('/sessions/' + privateEvent.id, null, undefined, eventPreview);
  assert.ok(publicEvent.includes('Ruth Demo'));
  assert.ok(publicEvent.includes('Enterprise Trainer'));
  assert.ok(publicEvent.includes('event-presenter-avatar'));
  assert.ok(publicEvent.includes('data:image/png;base64,'));
  assert.ok(render(eventDateUrl, null, undefined, eventPreview).includes(privateEvent.title));
  assert.ok(
    render('/', null, <UpcomingEventsSection />, eventPreview).includes(privateEvent.title),
  );
  assert.ok(teamResults.includes('>45<'));
  assert.ok(teamResults.includes('Certificates'));
  assert.ok(
    !render(
      '/dashboard/workspace?tab=member-results',
      'demo-university-staff',
      undefined,
      teamPreview,
    ).includes('Class enterprise'),
  );
  assert.ok(render('/dashboard/workspace?tab=school', 'demo-school').includes('Agreements'));
  assert.ok(
    render('/dashboard/workspace?tab=member-results', 'demo-founder').includes(
      'This workspace is unavailable for your role',
    ),
  );
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
    ).includes('Edit milestone: Customer interviews'),
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
