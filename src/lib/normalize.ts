/**
 * Single source of truth for geo-string normalization.
 * Used by cityCoords, metroRegions, and useProviders.
 * Strips accents, non-alpha chars, lowercases — memoized.
 */
const normalizeCache = new Map<string, string>();

export function normalize(value: string | null | undefined): string {
  if (!value) return '';

  const cached = normalizeCache.get(value);
  if (cached !== undefined) return cached;

  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');

  normalizeCache.set(value, normalized);
  return normalized;
}
