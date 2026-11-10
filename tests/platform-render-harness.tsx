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
import { JoinPage } from '../src/features/connect/JoinPage';
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
import type { DemoState } from '../src/domain/demo';
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
  ) {
    const account = custom.accounts.find((a) => a.id === id) ?? null;
    return renderToStaticMarkup(
      <ContentContext.Provider value={catalog}>
        <DemoContext.Provider
          value={{
            state: { ...custom, activeAccountId: id },
            account,
            enabled: true,
            error: '',
            execute: () => false,
            reset: () => {},
            clearError: () => {},
          }}
        >
          <MemoryRouter initialEntries={[path]}>
            {child ?? (
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<JoinPage />} />
                <Route path="/join" element={<JoinPage />} />
                <Route path="/apply" element={<ApplicationsPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/opportunities" element={<OpportunitiesPage />} />
                <Route path="/opportunities/:slug" element={<OpportunityDetail />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireDemo>
                      <RoleDashboard />
                    </RequireDemo>
                  }
                />
                <Route
                  path="/dashboard/workspace"
                  element={
                    <RequireDemo>
                      <WorkspacePage />
                    </RequireDemo>
                  }
                />
                <Route
                  path="/dashboard/cms"
                  element={
                    <RequireDemo roles={['content_manager', 'admin']}>
                      <CmsPage />
                    </RequireDemo>
                  }
                />
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
    '/login',
    '/register',
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
  const login = render('/login');
  const register = render('/register');
  assert.ok(login.includes('demo-account-grid'));
  assert.ok(login.includes('Find your place in the hub.'));
  for (const role of [
    'Guest',
    'Youth Entrepreneur / Learner',
    'Mentor',
    'Partner',
    'Investor',
    'Content Manager',
    'Platform Administrator',
  ])
    assert.ok(login.includes(`Login as ${role}`), role);
  assert.ok(register.includes('Where will your next step take you?'));
  assert.ok(register.includes('pathway-options'));
  assert.ok(render('/join').includes('pathway-options'));
  for (const html of [login, register, render('/join')]) {
    assert.ok(!html.includes('auth-shell'));
    assert.ok(!html.includes('Continue with Google'));
    assert.ok(!html.includes('name="password"'));
  }
  assert.ok(render('/apply').includes('Sign in before applying'));
  assert.ok(!render('/apply', 'demo-guest').includes('<option value="admin">'));
  assert.ok(render('/dashboard/cms', 'demo-guest').includes('different role'));
  assert.ok(render('/dashboard/cms', 'demo-founder').includes('different role'));
  for (const account of state.accounts) {
    const html = render('/dashboard', account.id);
    assert.ok(html.includes(account.name.split(' ')[0]!));
    count++;
  }
  assert.ok(!render('/dashboard', 'demo-guest').includes('Content studio'));
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
