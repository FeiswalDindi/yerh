import type { Catalog } from '../domain/content';

/** Implement this boundary in the host app; components never import a backend SDK. */
export interface ContentRepository {
  loadCatalog(signal?: AbortSignal): Promise<Catalog>;
}

export { mockContentRepository as localContentRepository } from './mock-content-repository';
