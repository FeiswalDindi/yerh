export interface SiteNavigation {
  id: string;
  label: string;
  href: string;
  children?: SiteNavigation[];
}
export type HeroOverlayStyle = 'navy' | 'dark' | 'gradient' | 'soft';

export type HomeSidebarWidgetKey = 'news' | 'links' | 'partners' | 'statistics' | 'socials';

export const DEFAULT_HOME_SIDEBAR_ORDER: readonly HomeSidebarWidgetKey[] = [
  'news',
  'links',
  'partners',
  'statistics',
  'socials',
];

const SIDEBAR_WIDGET_SET = new Set<string>(DEFAULT_HOME_SIDEBAR_ORDER);

export function normalizeHomeSidebarOrder(input?: unknown): HomeSidebarWidgetKey[] {
  const result: HomeSidebarWidgetKey[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (
        typeof item === 'string' &&
        SIDEBAR_WIDGET_SET.has(item) &&
        !result.includes(item as HomeSidebarWidgetKey)
      ) {
        result.push(item as HomeSidebarWidgetKey);
      }
    }
  }
  for (const fallback of DEFAULT_HOME_SIDEBAR_ORDER) {
    if (!result.includes(fallback)) {
      result.push(fallback);
    }
  }
  return result;
}

export interface ManagedPage {
  title: string;
  eyebrow: string;
  description: string;
  heroImage?: string;
  heroImageAlt?: string;
  heroOverlay?: HeroOverlayStyle;
  sections: { title: string; body: string }[];
}
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  positioning: string;
  bio: string;
  image: string;
  linkedinUrl: string;
}
export interface TeamContent {
  title: string;
  intro: string;
  sourceUrl: string;
  groupPhoto: { image: string; alt: string };
  members: TeamMember[];
}
export interface SiteContent {
  name: string;
  slogan: string;
  contact: { email: string; phone: string; whatsapp: string; address: string };
  socials: { label: string; href: string }[];
  navigation: SiteNavigation[];
  pages: Record<string, ManagedPage>;
  homeSections: Record<string, boolean>;
  homeSidebarOrder?: HomeSidebarWidgetKey[];
  footerCta?: { eyebrow: string; heading: string; buttonLabel: string; buttonHref: string };
  announcement?: { enabled: boolean; text: string; linkLabel: string; linkHref: string };
  copyrightNote?: string;
}
