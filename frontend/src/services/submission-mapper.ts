import type { ContentItem } from '../domain/content';
import type { Submission } from '../domain/demo';
export function publishedSubmissions(entries: Submission[]): ContentItem[] {
  return entries
    .filter((s) => s.status === 'published')
    .map((s) => ({
      id: s.id,
      slug: s.id,
      kind: s.kind,
      title: s.title,
      category: s.category,
      excerpt: s.body.slice(0, 180),
      image: null,
      imageAlt: '',
      publishedAt: null,
      authorId: s.ownerId,
      blocks: [{ type: 'paragraph', text: s.body }],
      downloads: [],
      videos: [],
      source: { path: 'local-demo', url: '', sha256: '' },
    }));
}
