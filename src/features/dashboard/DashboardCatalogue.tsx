import { ArrowRight, GraduationCap, Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DashboardCatalogueCards, type CatalogueEntry } from './DashboardCatalogueCards';
import { DashboardCatalogueSearch } from './DashboardCatalogueSearch';
import { DashboardCategoryRail } from './DashboardCategoryRail';
import { useCatalogueFilters } from './useCatalogueFilters';
import { coursePricing } from '../../domain/courses';
import { managesVenture, passedStage } from '../../domain/incubation';
import { WorkspaceDialog } from '../platform/WorkspaceControls';
import { workspaceHref } from './dashboard-navigation';

export function DashboardCatalogue({ kind }: { kind: 'learning' | 'marketplace' }) {
  const { account, state } = useDemo();
  const navigate = useNavigate();
  const { courses, items } = useCatalog();
  const { params, category, matches, update, clear, searchProps } = useCatalogueFilters();
  const learning = kind === 'learning';
  const title = learning ? 'Courses' : 'Marketplace';
  const Icon = learning ? GraduationCap : Store;
  const mine = learning && params.get('view') === 'mine';
  usePageTitle(title);
  if (!account) return null;
  const p = state.platform;
  const pathway = learning && account.role === 'entrepreneur';
  const ventures = pathway
    ? p.ventures.filter((venture) => managesVenture(p, account, venture))
    : [];
  const paths = ventures.map((venture) => {
    const path = [...p.incubations].reverse().find((entry) => entry.ventureId === venture.id);
    const complete = path
      ? p.training.curriculum.filter((stage) =>
          passedStage(p.training, path.id, stage.id, account.id),
        ).length
      : 0;
    return { venture, path, complete };
  });
  const latestPaths = [...paths].reverse();
  const currentPath =
    latestPaths.find((row) => row.path?.status === 'active') ?? latestPaths.find((row) => row.path);

  let entries: CatalogueEntry[];
  if (learning) {
    const enrolled = state.platform.enrollments[account.id] ?? [];
    const completed = state.progress[account.id] ?? [];
    entries = courses
      .filter((course) => !mine || enrolled.includes(course.id))
      .map((course) => {
        const total = course.lessonIds.length;
        const done = course.lessonIds.filter((id) => completed.includes(id)).length;
        const isEnrolled = enrolled.includes(course.id);
        const price = coursePricing(p, course.id);
        return {
          id: course.id,
          title: course.title,
          summary: course.description,
          category: course.level,
          details: `${total} ${total === 1 ? 'lesson' : 'lessons'}`,
          price,
          progress: isEnrolled && total ? { done, total } : undefined,
        };
      });
  } else {
    entries = items
      .filter((item) => item.kind === 'business')
      .map((item) => ({
        id: item.slug,
        title: item.title,
        summary: item.excerpt,
        category: item.category,
        image: item.image,
      }));
  }

  const results = entries.filter(matches);
  const filtered = category || searchProps.query;
  const singular = learning ? 'course' : 'listing';
  const resultLabel = results.length === 1 ? singular : `${singular}s`;

  return (
    <>
      {learning && (
        <PageIntro
          eyebrow={title}
          title={title}
          description="Choose a learning level, enroll, and continue your lessons here."
          className="dashboard-pane-intro"
        />
      )}
      <section className="container section dashboard-catalogue" aria-label={`${title} catalogue`}>
        {!learning && <h1 className="sr-only">Marketplace</h1>}
        {pathway && (
          <section className="dashboard-pathway">
            <WorkspaceDialog
              action="Open incubation pathway"
              title="Choose a venture"
              trigger={
                <>
                  <GraduationCap size={24} aria-hidden="true" />
                  <span>
                    <strong>Incubation Pathway</strong>
                    <small>
                      {currentPath
                        ? `${currentPath.venture.name} · ${currentPath.complete} of ${p.training.curriculum.length} stages passed`
                        : 'Choose a venture to start your pathway.'}
                    </small>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              }
            >
              {() =>
                paths.length ? (
                  <form
                    className="workspace-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const id = String(new FormData(event.currentTarget).get('venture'));
                      navigate(workspaceHref('incubation') + '&venture=' + encodeURIComponent(id));
                    }}
                  >
                    <label>
                      Venture
                      <select name="venture" defaultValue={currentPath?.venture.id}>
                        {paths.map((row) => (
                          <option key={row.venture.id} value={row.venture.id}>
                            {row.venture.name} · {row.complete}/{p.training.curriculum.length}{' '}
                            stages
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button">Continue to pathway</button>
                  </form>
                ) : (
                  <>
                    <p>Create a venture to start your incubation pathway.</p>
                    <Link className="button" to={workspaceHref('ventures')}>
                      Create a venture
                    </Link>
                  </>
                )
              }
            </WorkspaceDialog>
          </section>
        )}
        {learning && <h2 className="dashboard-general-courses">General Courses</h2>}
        <div className="dashboard-catalogue-toolbar">
          <DashboardCatalogueSearch label={`Search ${title.toLowerCase()}`} {...searchProps} />
          {learning && (
            <label className="dashboard-catalogue-view">
              <span className="sr-only">Filter courses by status</span>
              <select
                value={mine ? 'mine' : ''}
                onChange={(event) => update({ view: event.target.value, category: '' })}
              >
                <option value="">All courses</option>
                <option value="mine">My courses</option>
              </select>
            </label>
          )}
        </div>
        <DashboardCategoryRail
          entries={entries}
          category={category}
          icon={Icon}
          onChange={(value) => update({ category: value })}
        />
        <p className="dashboard-catalogue-count" role="status">
          {results.length} {resultLabel}
          {category ? ` · ${category}` : ''}
        </p>
        {results.length ? (
          <DashboardCatalogueCards items={results} kind={kind} icon={Icon} />
        ) : (
          <div className="empty-state">
            <h2>{mine && !filtered ? 'No courses enrolled yet' : `No ${resultLabel} found`}</h2>
            <p>
              {mine
                ? 'Switch to the full catalogue to find a course to get started with.'
                : 'Choose another category or clear your filters.'}
            </p>
            {(filtered || mine) && (
              <button type="button" className="button button-outline" onClick={clear}>
                Show all {title.toLowerCase()}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
