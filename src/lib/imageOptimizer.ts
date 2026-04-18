/**
 * Optimized image URL utility.
 * Converts Supabase storage public URLs to use the render/image transform endpoint.
 * Falls back to original URL for external images.
 * 
 * IMPORTANT: If Image Transforms are not available on the Supabase plan,
 * the <img> tag should use handleImageError from imageResolver.ts as onError
 * to fallback to original URLs gracefully.
 */

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i;

/** Check if a URL points to a video file */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return VIDEO_EXTENSIONS.test(url);
}

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Returns an optimized image URL using Supabase Image Transforms.
 * Only transforms Supabase storage URLs; external URLs pass through unchanged.
 * If transforms aren't available, the URL will 404 — use handleImageError on <img>.
 */
/**
 * Sanitiza a URL antes de processar:
 * - Bloqueia placeholders externos quebrados (ui-avatars.com)
 * - Reconstrói URL pública para caminhos relativos do storage
 */
function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (trimmed.includes('ui-avatars.com')) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/')) return trimmed;

  // Caminho relativo → reconstruir URL pública do bucket apropriado
  const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return '';
  const knownBuckets = ['avatars', 'portfolio', 'service-images', 'sponsors'];
  const firstSegment = trimmed.split('/')[0];
  const bucket = knownBuckets.includes(firstSegment) ? firstSegment : 'avatars';
  const path = knownBuckets.includes(firstSegment) ? trimmed.slice(firstSegment.length + 1) : trimmed;
  return `https://${projectId}.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

export function optimizedImageUrl(
  url: string | null | undefined,
  options: ImageOptions = {}
): string {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return '';

  // Never transform video URLs
  if (isVideoUrl(sanitized)) return sanitized;

  // Only transform Supabase storage URLs
  if (!sanitized.includes('/storage/v1/object/public/')) return sanitized;
  const url2 = sanitized;

  const { width, height, quality = 75, resize = 'cover' } = options;

  // Convert /object/public/ → /render/image/public/
  const transformUrl = url2.replace(
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

/**
 * Get the original (non-transformed) URL from either a render or object URL.
 * Useful as fallback when Image Transforms are not available.
 */
export function originalUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url
    .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
    .split('?')[0];
}

/* ── YouTube helpers ── */

const YT_REGEX = /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;

/** Check if a URL is a YouTube video link */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return YT_REGEX.test(url);
}

/** Extract the 11-char video ID from any YouTube URL format */
export function getYouTubeId(url: string): string | null {
  const m = url.match(YT_REGEX);
  return m ? m[1] : null;
}

/** Convert any YouTube URL to an embeddable URL */
export function getYouTubeEmbedUrl(url: string, autoplay = false): string {
  const id = getYouTubeId(url);
  if (!id) return url;
  return `https://www.youtube.com/embed/${id}${autoplay ? '?autoplay=1' : ''}`;
}

/** Get the default thumbnail for a YouTube video */
export function getYouTubeThumbnail(url: string): string {
  const id = getYouTubeId(url);
  if (!id) return '';
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
