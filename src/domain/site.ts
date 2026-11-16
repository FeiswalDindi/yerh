export interface SiteNavigation {
  id: string;
  label: string;
  href: string;
  children?: SiteNavigation[];
}
export interface ManagedPage {
  title: string;
  eyebrow: string;
  description: string;
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
}
