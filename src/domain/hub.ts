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
export interface HeroSlide {
  theme?: 'photo' | 'green';
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
export interface HomepageContent {
  statistics: { label: string; value: string; tone: string }[];
  statisticsNote: string;
  socialVideo: { url: string; title: string };
  featuredStories: string[];
  featuredBusinesses: string[];
  featuredBlogs: string[];
  featuredGuides: string[];
  slides: HeroSlide[];
  importantLinks: { label: string; href: string }[];
}
export interface Faq {
  question: string;
  answer: string;
}
