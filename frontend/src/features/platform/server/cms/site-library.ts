import type { Catalog } from '../../../../domain/content';
import type { CmsMediaAsset } from '../../../../services/laravel-cms-repository';

export interface SiteLibraryItem {
  key: string;
  url: string;
  name: string;
  alt: string;
  category: string;
  source: 'uploaded' | 'builtin';
  assetId?: number;
  folder?: string;
  mimeType: string;
}

function filenameFromUrl(url: string): string {
  const clean = url.split('?')[0] ?? url;
  return clean.split('/').pop() || 'site-asset';
}

export function collectSiteLibrary(
  catalog: Partial<Catalog> | null | undefined,
  media: CmsMediaAsset[] = [],
): SiteLibraryItem[] {
  const items: SiteLibraryItem[] = [];
  const seenUrls = new Set<string>();

  for (const asset of media) {
    const url = asset.url?.trim();
    if (!asset.in_site_library || !url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    items.push({
      key: `uploaded-${asset.id}`,
      url,
      name: asset.original_name || filenameFromUrl(url),
      alt: asset.alt_text || asset.original_name || '',
      category: asset.folder || 'general',
      source: 'uploaded',
      assetId: asset.id,
      folder: asset.folder,
      mimeType: asset.mime_type || 'image/webp',
    });
  }

  const addBuiltIn = (url: string | undefined | null, category: string, alt = '') => {
    const trimmed = url?.trim();
    if (!trimmed || seenUrls.has(trimmed)) return;
    seenUrls.add(trimmed);
    const name = filenameFromUrl(trimmed);
    items.push({
      key: `builtin-${trimmed}`,
      url: trimmed,
      name,
      alt: (alt ?? '').trim() || name,
      category,
      source: 'builtin',
      mimeType: /\.pdf(\?|$)/i.test(trimmed) ? 'application/pdf' : 'image/*',
    });
  };

  if (catalog) {
    addBuiltIn(catalog.media?.logo, 'Brand', 'YERH Logo');
    addBuiltIn(catalog.media?.wordmark, 'Brand', 'YERH Wordmark');
    addBuiltIn(catalog.media?.team, 'Team', 'YERH Team');
    addBuiltIn(catalog.media?.developers, 'Team', 'YERH Team Members');
    addBuiltIn(catalog.media?.workshop, 'General', 'Entrepreneurship Workshop');
    addBuiltIn(catalog.media?.business, 'General', 'Youth Enterprise');

    for (const slide of catalog.homepage?.slides ?? []) {
      addBuiltIn(slide.image, 'Hero', slide.alt || slide.title);
    }
    for (const partner of catalog.media?.partners ?? []) {
      addBuiltIn(partner.image, 'Partners', partner.name);
    }
    for (const entry of catalog.items ?? []) {
      if (entry.image) addBuiltIn(entry.image, 'Editorial', entry.imageAlt || entry.title);
    }
    for (const [path, page] of Object.entries(catalog.site?.pages ?? {})) {
      if (page?.heroImage) {
        addBuiltIn(page.heroImage, 'Pages', page.heroImageAlt || page.title || path);
      }
    }
  }

  return items;
}
