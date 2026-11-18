import { useMemo, type ReactNode } from 'react';
import { useCatalog, ContentContext } from './useCatalog';
import { useDemo } from './useDemo';
import { publishedSubmissions } from '../services/submission-mapper';
import { canPublishProduct } from '../domain/incubation';
/** Optional demo enrichment. Public components only depend on ContentProvider. */
export function DemoCatalogOverlay({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const { state, enabled } = useDemo();
  const value = useMemo(() => {
    if (!enabled) return catalog;
    const published = state.platform.cmsReleases.at(-1)?.snapshot.catalog ?? catalog;
    const submissions = publishedSubmissions(state.submissions);
    const base = published.items.filter((i) => !i.source.path.startsWith('local-demo'));
    const entries = [...base, ...submissions.filter((s) => !base.some((i) => i.id === s.id))];
    for (const venture of state.platform.ventures.filter((v) => v.status === 'approved'))
      entries.push({
        id: venture.id,
        slug: `venture-${venture.id}`,
        kind: 'business',
        title: venture.name,
        category: venture.sector,
        excerpt: venture.description,
        image: null,
        imageAlt: '',
        publishedAt: null,
        authorId: venture.ownerId,
        blocks: [
          { type: 'paragraph', text: venture.description },
          { type: 'paragraph', text: `${venture.stage} · ${venture.location}` },
        ],
        downloads: [],
        videos: [],
        source: { path: 'local-demo-venture', url: '', sha256: '' },
      });
    for (const product of state.platform.products.filter((v) =>
      canPublishProduct(state.platform, v),
    ))
      entries.push({
        id: product.id,
        slug: `product-${product.id}`,
        kind: 'business',
        title: product.name,
        category: 'Products & services',
        excerpt: product.description,
        image: null,
        imageAlt: '',
        publishedAt: null,
        authorId: product.ownerId,
        blocks: [
          { type: 'paragraph', text: product.description },
          { type: 'paragraph', text: `Price: KES ${product.price.toLocaleString()}` },
        ],
        downloads: [],
        videos: [],
        source: { path: 'local-demo-product', url: '', sha256: '' },
      });
    const featuredSchools = state.platform.training.institutions.filter(
      (school) => school.featured && school.status === 'active',
    );
    for (const school of featuredSchools)
      entries.push({
        id: `institution-${school.id}`,
        slug: `institution-${school.id}`,
        kind: 'story',
        title: school.name,
        category: 'Institution success stories',
        excerpt: school.story,
        image: null,
        imageAlt: '',
        publishedAt: null,
        blocks: [{ type: 'paragraph', text: school.story }],
        downloads: [],
        videos: [],
        source: { path: 'local-demo-institution', url: '', sha256: '' },
      });
    return {
      ...published,
      homepage: {
        ...published.homepage,
        featuredStories: [
          ...published.homepage.featuredStories,
          ...featuredSchools.map((school) => `institution-${school.id}`),
        ],
      },
      team: published.team ?? catalog.team,
      items: [
        ...new Map(entries.filter((i) => i.status !== 'archived').map((i) => [i.id, i])).values(),
      ],
    };
  }, [catalog, state, enabled]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
