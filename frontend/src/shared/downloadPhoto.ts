import { resolveMediaUrl } from './mediaUrl.ts';

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugifyStem(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function suggestPhotoFilename(src: string, label?: string, mimeType?: string): string {
  const cleanPath = src.split(/[?#]/)[0] ?? '';
  const lastSegment = cleanPath.split('/').filter(Boolean).pop() ?? '';
  const extMatch = lastSegment.match(/\.(jpe?g|png|webp|gif|avif|svg)$/i);
  const mimeExt = mimeType
    ? MIME_TO_EXTENSION[mimeType.split(';')[0]!.trim().toLowerCase()]
    : undefined;
  const ext = extMatch ? extMatch[1]!.toLowerCase() : (mimeExt ?? 'jpg');

  const labelStem = label ? slugifyStem(label) : '';
  let stem = labelStem;
  if (!stem && lastSegment) {
    const rawStem = lastSegment.replace(/\.[a-z0-9]+$/i, '');
    if (rawStem && !UUID_PATTERN.test(rawStem)) {
      stem = slugifyStem(rawStem);
    }
  }

  return `${stem || 'yerh-photo'}.${ext}`;
}

export async function downloadPhoto(src: string, label?: string): Promise<void> {
  const trimmed = src.trim();
  if (!trimmed || /^(javascript|vbscript):/i.test(trimmed)) return;
  const resolved = resolveMediaUrl(trimmed, { preferOriginal: true }) || trimmed;

  try {
    const response = await fetch(resolved, { credentials: 'same-origin' });
    if (response.ok) {
      const blob = await response.blob();
      const filename = suggestPhotoFilename(trimmed, label, blob.type || undefined);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      return;
    }
  } catch {
    // Fall back to direct navigation / attachment download when cross-origin fetch is restricted.
  }

  const fallbackHref = trimmed.startsWith('/api/v1/cms/media/')
    ? `${resolved}${resolved.includes('?') ? '&' : '?'}download=1`
    : resolved;
  const link = document.createElement('a');
  link.href = fallbackHref;
  link.download = suggestPhotoFilename(trimmed, label);
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
}
