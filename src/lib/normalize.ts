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

/**
 * Formats a location string: trims, fixes spacing around commas/punctuation,
 * removes duplicate commas, and capitalizes each segment.
 * e.g. "Pinhais, Piraquara , São José , E região" → "Pinhais, Piraquara, São José e região"
 */
export function formatLocationString(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\s+,/g, ',')        // remove spaces before commas
    .replace(/,\s*/g, ', ')       // normalize space after commas
    .replace(/,{2,}/g, ',')      // remove duplicate commas
    .replace(/\s+/g, ' ')        // collapse multiple spaces
    .replace(/, E /gi, ' e ')    // ", E " → " e "
    .trim();
}
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
