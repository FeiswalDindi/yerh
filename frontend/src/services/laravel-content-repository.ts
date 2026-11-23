import { localContentRepository, type ContentRepository } from './content-repository';
import { editorialRepository } from './laravel-editorial-repository';

export const laravelContentRepository: ContentRepository = {
  async loadCatalog(signal) {
    const [base, feed] = await Promise.all([
      localContentRepository.loadCatalog(signal),
      editorialRepository.publicFeed(signal),
    ]);
    const items = new Map(base.items.map((item) => [item.id, item]));
    feed.hidden.forEach((id) => items.delete(id));
    feed.items.forEach((item) => items.set(item.id, item));

    return {
      ...base,
      items: [...items.values()],
      homepage: {
        ...base.homepage,
        featuredStories: [
          ...new Set([
            ...feed.featured,
            ...base.homepage.featuredStories.filter((id) => items.has(id)),
          ]),
        ],
      },
    };
  },
};
