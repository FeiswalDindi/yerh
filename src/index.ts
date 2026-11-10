// Integration surface for a host application. Keep backend dependencies out of this package.
export { ContentProvider } from './app/ContentProvider';
export { createYerhRoutes } from './app/routes';
export { HomePage } from './features/home/HomePage';
export { SiteLayout } from './layout/SiteLayout';
export type { ContentRepository } from './services/content-repository';
export type { Catalog, ContentItem, ContentKind } from './domain/content';

export { DemoProvider } from './app/DemoProvider';
export type { DemoRepository } from './services/demo-repository';
export type { DemoState, DemoAction, DemoAccount } from './domain/demo';

export { DemoCatalogOverlay } from './app/DemoCatalogOverlay';
