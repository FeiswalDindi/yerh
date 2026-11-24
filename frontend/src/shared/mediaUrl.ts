import { MEDIA_DIMENSIONS, MEDIA_WEBP_VARIANTS } from '../config/media-variants.ts';

const DYNAMIC_MEDIA_PATTERN =
  /^\/api\/v1\/(?:cms\/media\/[0-9a-f-]+|marketplace-sectors\/\d+\/image|marketplace\/[^/?#]+\/image)(?:\?|$)/i;

function defaultBase(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

function normalizeBasePrefix(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

export function resolveMediaUrl(
  src: string | null | undefined,
  options?: { width?: number; preferOriginal?: boolean; baseUrl?: string },
): string {
  const trimmed = (src ?? '').trim();
  if (!trimmed) return '';

  if (/^(?:data:|blob:|https?:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  const hashIndex = trimmed.indexOf('#');
  const beforeHash = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const hashSuffix = hashIndex === -1 ? '' : trimmed.slice(hashIndex);

  const queryIndex = beforeHash.indexOf('?');
  const pathOnly = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1);

  if (pathOnly.startsWith('/media/')) {
    const targetPath = options?.preferOriginal
      ? pathOnly
      : (MEDIA_WEBP_VARIANTS[pathOnly] ?? pathOnly);
    const prefix = normalizeBasePrefix(options?.baseUrl ?? defaultBase());
    const querySuffix = queryString ? `?${queryString}` : '';
    return `${prefix}${targetPath}${querySuffix}${hashSuffix}`;
  }

  if (
    options?.width &&
    Number.isFinite(options.width) &&
    options.width > 0 &&
    DYNAMIC_MEDIA_PATTERN.test(beforeHash) &&
    !/(?:^|&)(?:w|download)=/i.test(queryString)
  ) {
    const rounded = Math.round(options.width);
    const nextQuery = queryString ? `${queryString}&w=${rounded}` : `w=${rounded}`;
    return `${pathOnly}?${nextQuery}${hashSuffix}`;
  }

  return trimmed;
}

export function buildMediaSrcSet(
  src: string | null | undefined,
  widths: number[] = [480, 800, 1200],
): string | undefined {
  const trimmed = (src ?? '').trim();
  if (!trimmed || !DYNAMIC_MEDIA_PATTERN.test(trimmed)) return undefined;
  if (/(?:^|[?&])(?:w|download)=/i.test(trimmed)) return undefined;

  const entries = widths
    .filter((w) => Number.isFinite(w) && w > 0)
    .map((width) => `${resolveMediaUrl(trimmed, { width })} ${Math.round(width)}w`);

  return entries.length > 0 ? entries.join(', ') : undefined;
}

export function getMediaDimensions(
  src: string | null | undefined,
): { width: number; height: number } | undefined {
  const trimmed = (src ?? '').trim();
  if (!trimmed) return undefined;

  const cleanPath = trimmed.split(/[?#]/)[0] ?? '';
  const canonical = cleanPath.startsWith('/ui/media/') ? cleanPath.slice(3) : cleanPath;
  return MEDIA_DIMENSIONS[canonical];
}
