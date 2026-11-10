import type { Course, EntrepreneurshipTopic, Faq, HomepageContent, Lesson } from './hub';
import type { SidebarData } from './sidebar';
import type { TermsDocument } from './legal';
import type { SiteContent } from './site';
export type ContentKind = 'article' | 'story' | 'business' | 'event' | 'publication' | 'resource';
export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list-item';
  text: string;
}
export interface ContentItem {
  id: string;
  slug: string;
  kind: ContentKind;
  title: string;
  category: string;
  excerpt: string;
  image: string | null;
  imageAlt: string;
  publishedAt: string | null;
  authorId?: string;
  status?: 'published' | 'archived';
  storyGroups?: ('Entrepreneur' | 'Startups')[];
  displayLines?: { line1: string; line2: string };
  contactLinks?: { label: string; text: string; href: string }[];
  socialLabels?: string[];
  rating?: number;
  commentCount?: number;
  blocks: ContentBlock[];
  downloads: { label: string; href: string; availableLocally: boolean }[];
  videos: string[];
  source: { path: string; url: string; sha256: string };
}
export interface Catalog {
  site: SiteContent;
  sidebar: SidebarData;
  terms: TermsDocument;
  items: ContentItem[];
  lessons: Lesson[];
  courses: Course[];
  topics: EntrepreneurshipTopic[];
  faqs: Faq[];
  homepage: HomepageContent;
  media: {
    team: string;
    developers: string;
    workshop: string;
    business: string;
    logo: string;
    wordmark: string;
    partners: { name: string; image: string; url: string }[];
  };
}
export const kindPaths: Record<ContentKind, string> = {
  article: '/publications/blogs',
  story: '/publications/stories',
  business: '/marketplace',
  event: '/events',
  publication: '/publications/reports',
  resource: '/resources',
};
export function contentPath(item: Pick<ContentItem, 'kind' | 'slug'>): string {
  return `${kindPaths[item.kind]}/${encodeURIComponent(item.slug)}`;
}
export function filterContent(
  items: readonly ContentItem[],
  query = '',
  category = 'All',
): ContentItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(
    (item) =>
      (category === 'All' || item.category === category) &&
      terms.every((term) =>
        `${item.title} ${item.excerpt} ${item.category}`.toLocaleLowerCase().includes(term),
      ),
  );
}
