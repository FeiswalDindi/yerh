export const site = {
  name: 'Youth Entrepreneurship Resource Hub',
  shortName: 'YERH',
  contact: {
    email: 'yerhdev@gmail.com',
    phone: '+254768980297',
    whatsapp: '+254768980297',
    address: 'Nairobi, Kenya',
  },
  socials: [
    { label: 'YouTube', href: 'https://www.youtube.com/channel/UCTZJEmbJzJPVJ4lHQ43ApqA' },
    { label: 'WhatsApp', href: 'https://wa.me/254768980297' },
    { label: 'Facebook', href: 'https://www.facebook.com/P.Copyek' },
    { label: 'Instagram', href: 'https://www.instagram.com/copyek/' },
  ],
} as const;

export function platformHref(path: '/login' | '/register'): string | null {
  const configured = import.meta.env.VITE_PLATFORM_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return new URL(path, url.origin).href;
  } catch {
    return null;
  }
}

export const socialLinks = {
  youtube: 'https://www.youtube.com/channel/UCTZJEmbJzJPVJ4lHQ43ApqA',
  whatsapp: 'https://wa.me/254768980297',
  facebook: 'https://www.facebook.com/P.Copyek',
  instagram: 'https://www.instagram.com/copyek/',
} as const;
