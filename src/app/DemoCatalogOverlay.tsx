import { useMemo, type ReactNode } from 'react';
import { useCatalog, ContentContext } from './useCatalog';
import { useDemo } from './useDemo';
import { publishedSubmissions } from '../services/submission-mapper';
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
    for (const product of state.platform.products.filter(
      (v) =>
        v.status === 'approved' &&
        state.platform.ventures.some(
          (venture) => venture.id === v.ventureId && venture.status === 'approved',
        ),
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
    return {
      ...published,
      items: [
        ...new Map(entries.filter((i) => i.status !== 'archived').map((i) => [i.id, i])).values(),
      ],
    };
  }, [catalog, state, enabled]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
