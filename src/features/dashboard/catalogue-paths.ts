export const dashboardCataloguePaths = {
  learning: '/dashboard/learning',
  events: '/dashboard/events',
  opportunities: '/dashboard/opportunities',
  marketplace: '/dashboard/marketplace',
} as const;

export type DashboardCatalogueKind = keyof typeof dashboardCataloguePaths;

export function dashboardCatalogueItemPath(kind: DashboardCatalogueKind, id: string, search = '') {
  return `${dashboardCataloguePaths[kind]}/${encodeURIComponent(id)}${search}`;
}
