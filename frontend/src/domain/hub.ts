export interface Lesson {
  id: string;
  title: string;
  href: string;
  track: string;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  lessonIds: string[];
}
export interface EntrepreneurshipTopic {
  id: string;
  title: string;
  description: string;
  lessonTrack: string;
  guideIds: string[];
  checklist: string[];
  sourceNote: string;
}
export type HeroSlideTheme =
  'photo' | 'dark' | 'spotlight' | 'gold' | 'navy' | 'green' | 'split-navy' | 'split-gold';

export interface HeroSlide {
  theme?: HeroSlideTheme;
  archived?: boolean;
  eyebrow: string;
  title: string;
  secondLine: string;
  accent: string;
  text: string;
  image: string;
  alt: string;
  href: string;
  action: string;
  caption: string;
}
export interface ImportantLink {
  label: string;
  href: string;
  openInNewTab?: boolean;
}

export function resolveImportantLinkMode(
  link: Pick<ImportantLink, 'href' | 'openInNewTab'>,
): 'new-tab' | 'same-page-internal' | 'same-page-external' {
  if (link.openInNewTab !== false) return 'new-tab';
  const trimmed = (link.href ?? '').trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return 'same-page-internal';
  }
  return 'same-page-external';
}

export interface HomepageContent {
  statistics: { label: string; value: string; tone: string }[];
  statisticsNote: string;
  useLiveStats?: boolean;
  socialVideo: { url: string; title: string };
  featuredStories: string[];
  featuredBusinesses: string[];
  featuredBlogs: string[];
  featuredGuides: string[];
  slides: HeroSlide[];
  importantLinks: ImportantLink[];
}
export interface Faq {
  question: string;
  answer: string;
}
