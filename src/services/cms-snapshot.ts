import type { Catalog } from '../domain/content';
import type { DemoState } from '../domain/demo';
import type { CmsSnapshot } from '../domain/platform';

/** Editorial records retain archived entries; live workflow records stay in their own modules. */
export function createCmsSnapshot(catalog: Catalog, state: DemoState): CmsSnapshot {
  const published = state.platform.cmsReleases.at(-1)?.snapshot.catalog ?? catalog;
  return structuredClone({
    catalog: {
      ...published,
      items: [
        ...published.items.filter((i) => !i.source.path.startsWith('local-demo')),
        ...catalog.items.filter((i) => i.source.path.startsWith('local-demo')),
      ],
    },
    sessions: state.sessions,
    opportunities: state.platform.opportunities,
    community: {
      forums: state.forums.map(({ memberIds: _ids, ...forum }) => {
        void _ids;
        return forum;
      }),
      groups: state.groups.map(({ memberIds: _ids, ...group }) => {
        void _ids;
        return group;
      }),
    },
  });
}
