/**
 * Optimized image URL utility.
 * Converts Supabase storage public URLs to use the render/image transform endpoint.
 * Falls back to original URL for external images.
 */

const SUPABASE_HOST = import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || '';

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Returns an optimized image URL using Supabase Image Transforms.
 * Only transforms Supabase storage URLs; external URLs pass through unchanged.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  options: ImageOptions = {}
): string {
  if (!url) return '';

  // Only transform Supabase storage URLs
  if (!url.includes('/storage/v1/object/public/')) return url;

  const { width, height, quality = 75, resize = 'cover' } = options;

  // Convert /object/public/ → /render/image/public/
  const transformUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  params.set('resize', resize);

  return `${transformUrl}?${params.toString()}`;
}

/** Preset: avatar thumbnail (56x56 in cards, rendered at 2x for retina) */
export function avatarThumb(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 112, height: 112, quality: 70 });
}

/** Preset: avatar large (profile page, 96x96 rendered at 2x) */
export function avatarLarge(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 192, height: 192, quality: 75 });
}

/** Preset: service image card (max 400px wide) */
export function serviceImageThumb(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 400, quality: 70 });
}

/** Preset: portfolio thumbnail (grid, ~300px) */
export function portfolioThumb(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 300, height: 300, quality: 70 });
}

/** Preset: portfolio full view (~1200px) */
export function portfolioFull(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 1200, quality: 80 });
}

/** Preset: cover image (hero/banner, full width) */
export function coverImage(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 1200, quality: 75, resize: 'cover' });
}

/** Preset: sponsor image */
export function sponsorImage(url: string | null | undefined): string {
  return optimizedImageUrl(url, { width: 600, quality: 70, resize: 'contain' });
}
