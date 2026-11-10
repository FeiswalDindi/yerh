import type { Catalog } from '../domain/content';
import type { ContentRepository } from './content-repository';
import { mediaAssets } from '../config/media';

/** Fixture imports belong here only. Replace this adapter with an HTTP/CMS implementation. */
export const mockContentRepository: ContentRepository = {
  async loadCatalog(signal) {
    const [
      blogs,
      stories,
      businesses,
      events,
      reports,
      lessons,
      partners,
      homepage,
      faqs,
      courses,
      topics,
      memberPosts,
      sidebar,
      terms,
      site,
    ] = await Promise.all([
      import('../mocks/data/blogs.json'),
      import('../mocks/data/stories.json'),
      import('../mocks/data/businesses.json'),
      import('../mocks/data/events.json'),
      import('../mocks/data/reports.json'),
      import('../mocks/data/lessons.json'),
      import('../mocks/data/partners.json'),
      import('../mocks/data/homepage.json'),
      import('../mocks/data/faqs.json'),
      import('../mocks/data/learning.json'),
      import('../mocks/data/entrepreneurship.json'),
      import('../mocks/data/member-posts.json'),
      import('../mocks/data/sidebar.json'),
      import('../mocks/data/terms.json'),
      import('../mocks/data/site.json'),
    ]);
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const catalog = {
      sidebar: sidebar.default,
      terms: terms.default,
      site: site.default,
      items: [
        ...blogs.default,
        ...stories.default,
        ...businesses.default,
        ...events.default,
        ...reports.default,
        ...memberPosts.default,
      ],
      lessons: lessons.default,
      courses: courses.default,
      topics: topics.default,
      faqs: faqs.default,
      homepage: homepage.default,
      media: { ...mediaAssets, partners: partners.default },
    } as Catalog;
    const ids = new Set(catalog.items.map((item) => item.id));
    if (ids.size !== catalog.items.length) throw new Error('Duplicate catalog IDs');
    return catalog;
  },
};
