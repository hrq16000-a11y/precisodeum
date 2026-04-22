/**
 * Universal Image Resolution Layer
 * 
 * Priority order:
 * 1. media table (if entry exists)
 * 2. entity-specific tables (service_images, etc.)
 * 3. direct fields (image_url, avatar_url, photo_url)
 * 4. null (no image found)
 * 
 * All URLs pass through safe optimization that never breaks originals.
 */

import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_LOGO_URL, DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/siteAssets';

export type EntityType = 'service' | 'profile' | 'provider' | 'banner' | 'sponsor' | 'portfolio';

export interface ResolvedImage {
  url: string;
  source: 'media' | 'service_images' | 'direct' | 'storage';
  id?: string;
}

/**
 * Safely optimize a Supabase storage URL.
 * Returns original URL if it's external or if transforms aren't available.
 * Uses simple query params that degrade gracefully.
 */
export function safeImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url;
}

/**
 * Get optimized thumbnail URL. Uses Supabase render endpoint with graceful fallback.
 * The <img> tag's onerror should fallback to original URL.
 */
/**
 * Inject Supabase Storage transformation params (width, quality, webp).
 * Safely no-ops on external/non-Supabase URLs.
 */
export function getOptimizedUrl(
  url: string | null | undefined,
  width = 400,
  quality = 75
): string {
  if (!url) return '';
  if (!url.includes('supabase.co/storage') && !url.includes('/storage/v1/')) return url;
  // Prefer the render endpoint when applicable
  const base = url.includes('/storage/v1/object/public/')
    ? url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    : url;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${width}&quality=${quality}&format=webp&resize=cover`;
}

export function thumbUrl(url: string | null | undefined, width = 400): string {
  if (!url) return '';
  if (!url.includes('/storage/v1/object/public/')) return url;

  // Build render URL but keep original accessible via data attribute
  const renderUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );
  return `${renderUrl}?width=${width}&quality=75&resize=cover`;
}

/**
 * Resolve images for any entity.
 * Checks media table first, then falls back to legacy sources.
 */
export async function getEntityImages(
  entityType: EntityType,
  entityId: string
): Promise<ResolvedImage[]> {
  const results: ResolvedImage[] = [];

  // 1. Check media table first
  try {
    const { data: mediaRows } = await supabase
      .from('media')
      .select('id, public_url')
      .eq('entity_type', entityType)
      .eq('entity_ref', entityId)
      .eq('is_active', true)
      .order('created_at');

    if (mediaRows && mediaRows.length > 0) {
      return mediaRows.map(m => ({
        url: m.public_url,
        source: 'media' as const,
        id: m.id,
      }));
    }
  } catch {
    // media table might not exist yet, continue with fallback
  }

  // 2. Check entity-specific tables
  if (entityType === 'service') {
    const { data: serviceImages } = await supabase
      .from('service_images')
      .select('id, image_url')
      .eq('service_id', entityId)
      .order('display_order');

    if (serviceImages && serviceImages.length > 0) {
      return serviceImages.map(si => ({
        url: si.image_url,
        source: 'service_images' as const,
        id: si.id,
      }));
    }
  }

  if (entityType === 'provider') {
    const { data: prov } = await supabase
      .from('providers')
      .select('photo_url')
      .eq('id', entityId)
      .maybeSingle();

    if (prov?.photo_url) {
      results.push({ url: prov.photo_url, source: 'direct' });
    }
  }

  if (entityType === 'profile') {
    const { data: prof } = await supabase
      .from('public_profiles' as any)
      .select('avatar_url')
      .eq('id', entityId)
      .maybeSingle() as any;

    if (prof?.avatar_url) {
      results.push({ url: prof.avatar_url, source: 'direct' });
    }
  }

  return results;
}

/**
 * React-friendly image src with onError fallback.
 * Use in img tags: <img src={url} onError={handleImageError} />
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const originalSrc = img.dataset.originalSrc || img.src;

  // If we're on a /render/ URL, fallback to /object/ URL
  if (img.src.includes('/render/image/public/')) {
    const fallback = img.src
      .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
      .split('?')[0]; // Remove query params
    img.dataset.originalSrc = originalSrc;
    img.src = fallback;
    return;
  }

  // Last resort: show a neutral placeholder instead of hiding
  img.src = '/placeholder.svg';
  img.style.objectFit = 'contain';
  img.style.background = 'hsl(var(--muted))';
}

export function handleBrandImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  type: 'logo' | 'social' = 'logo'
) {
  const img = e.currentTarget;
  const fallback = type === 'social' ? DEFAULT_SOCIAL_IMAGE_URL : DEFAULT_LOGO_URL;
  const currentSrc = img.currentSrc || img.src;

  img.removeAttribute('srcset');
  img.removeAttribute('sizes');

  if (!currentSrc.endsWith(fallback) && img.src !== fallback) {
    img.src = fallback;
    return;
  }

  img.src = '/placeholder.svg';
  img.style.objectFit = 'contain';
  img.style.background = 'hsl(var(--muted))';
}
