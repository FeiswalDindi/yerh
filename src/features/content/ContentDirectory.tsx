import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { filterContent, type ContentKind } from '../../domain/content';
import { usePageTitle } from '../../shared/usePageTitle';
import { useSavedItems } from '../../shared/useSavedItems';
import { PageIntro } from '../../shared/PageIntro';
import { ContentCard } from './ContentCard';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';

const descriptions: Record<ContentKind, { title: string; description: string; eyebrow: string }> = {
  article: {
    title: 'Ideas worth exploring.',
    eyebrow: 'Blogs',
    description: 'Practical perspectives, research, and stories from the YERH community.',
  },
  story: {
    title: 'Every business starts with a story.',
    eyebrow: 'Success stories',
    description:
      'Meet the people turning ambition into action. Discover their journeys, their lessons, and what keeps them going.',
  },
  business: {
    title: 'Built with purpose. Made in Kenya.',
    eyebrow: 'Business directory',
    description: 'Discover youth enterprises across industries and the people building them.',
  },
  event: {
    title: 'Learn together. Grow together.',
    eyebrow: 'Events & workshops',
    description:
      'Explore past workshops and gatherings from the original YERH programme. New dates will appear when the programme is updated.',
  },
  publication: {
    title: 'Knowledge that moves us forward.',
    eyebrow: 'Publications',
    description:
      'Reports, advocacy briefs, and lessons from the Co-Production for Youth Entrepreneurship in Kenya project.',
  },
  resource: {
    title: 'Put your next idea into motion.',
    eyebrow: 'Resources',
    description: 'Explore practical guides and knowledge for your entrepreneurial journey.',
  },
};
export function ContentDirectory({
  kind,
  savedOnly = false,
  search = false,
}: {
  kind?: ContentKind;
  savedOnly?: boolean;
  search?: boolean;
}) {
  const { items } = useCatalog();
  const { ids } = useSavedItems();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('category') || 'All';
  const config = kind
    ? descriptions[kind]
    : savedOnly
      ? {
          title: 'Your inspiration, in one place.',
          eyebrow: 'Saved resources',
          description:
            'Articles, stories, and businesses you’ve saved on this browser. Come back whenever you need a little inspiration.',
        }
      : {
          title: 'Find your next possibility.',
          eyebrow: 'Search the hub',
          description: 'Search stories, insights, publications, and businesses across the hub.',
        };
  usePageTitle(config.eyebrow);
  const scope = items.filter(
    (item) => (!kind || item.kind === kind) && (!savedOnly || ids.includes(item.id)),
  );
  const categories = ['All', ...new Set(scope.map((item) => item.category))];
  const results = filterContent(scope, query, category);
  const hasSidebar = !!kind && ['article', 'story', 'publication', 'resource'].includes(kind);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== 'All') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  return (
    <>
      <PageIntro {...config} />
      <section className="container directory-section">
        <div className={hasSidebar ? 'content-with-sidebar' : undefined}>
          <div className="discovery-main">
            <div className="filter-toolbar">
              <div className="search-input">
                <Search size={20} />
                <label className="sr-only" htmlFor="directory-search">
                  Search {config.eyebrow.toLowerCase()}
                </label>
                <input
                  id="directory-search"
                  type="search"
                  autoFocus={search}
                  placeholder="What would you like to discover?"
                  value={query}
                  onChange={(e) => update('q', e.target.value)}
                />
              </div>
              <label className="category-select">
                <SlidersHorizontal size={17} />
                <span className="sr-only">Filter by category</span>
                <select value={category} onChange={(e) => update('category', e.target.value)}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="result-count" role="status">
              {results.length} {results.length === 1 ? 'result' : 'results'}
              {query ? ` for “${query}”` : ''}
              {kind === 'event' && ' · Past events'}
            </p>
            {results.length ? (
              <div className="content-grid">
                {results.map((item) => (
                  <ContentCard item={item} key={item.id} portrait={kind === 'story'} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={32} />
                <h2>
                  {savedOnly && !scope.length
                    ? 'Your next discovery is waiting.'
                    : 'No matches just yet.'}
                </h2>
                <p>
                  {savedOnly && !scope.length
                    ? 'Use the bookmark button on a story or resource to save it here.'
                    : 'Try a different search or clear your filters.'}
                </p>
                {(query || category !== 'All') && (
                  <button className="button" onClick={() => setParams({})}>
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
          {hasSidebar && <DiscoverySidebar kind={kind} />}
        </div>
      </section>
    </>
  );
}
