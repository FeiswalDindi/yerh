import { GraduationCap, Store } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DashboardCatalogueCards, type CatalogueEntry } from './DashboardCatalogueCards';
import { DashboardCatalogueSearch } from './DashboardCatalogueSearch';
import { DashboardCategoryRail } from './DashboardCategoryRail';
import { useCatalogueFilters } from './useCatalogueFilters';

export function DashboardCatalogue({ kind }: { kind: 'learning' | 'marketplace' }) {
  const { account, state } = useDemo();
  const { courses, items } = useCatalog();
  const { params, category, matches, update, clear, searchProps } = useCatalogueFilters();
  const learning = kind === 'learning';
  const title = learning ? 'Courses' : 'Marketplace';
  const Icon = learning ? GraduationCap : Store;
  const mine = learning && params.get('view') === 'mine';
  usePageTitle(title);
  if (!account) return null;

  let entries: CatalogueEntry[];
  if (learning) {
    const enrolled = state.platform.enrollments[account.id] ?? [];
    const completed = state.progress[account.id] ?? [];
    const awarded = new Set(
      state.platform.certificates.filter((c) => c.accountId === account.id).map((c) => c.courseId),
    );
    entries = courses
      .filter((course) => !mine || enrolled.includes(course.id))
      .map((course) => {
        const total = course.lessonIds.length;
        const done = course.lessonIds.filter((id) => completed.includes(id)).length;
        const isEnrolled = enrolled.includes(course.id);
        return {
          id: course.id,
          title: course.title,
          summary: course.description,
          category: course.level,
          details: `${total} ${total === 1 ? 'lesson' : 'lessons'}`,
          progress: isEnrolled && total ? { done, total } : undefined,
          status: awarded.has(course.id)
            ? 'Certificate issued'
            : isEnrolled && total > 0 && done === total
              ? 'Certificate awaiting issuance'
              : undefined,
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
