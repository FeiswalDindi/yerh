import site from '../mocks/data/site.json' with { type: 'json' };
import type { SiteNavigation } from '../domain/site';
export type NavigationItem = SiteNavigation;
/** Seed navigation lives with other database-backed content; the CMS can publish an override. */
export const navigation: NavigationItem[] = site.navigation;
