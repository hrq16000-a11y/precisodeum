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
/**
 * Capitalizes a person's name respecting Portuguese prepositions.
 * e.g. "luiz marcelo de sousa" → "Luiz Marcelo de Sousa"
 */
const LOWERCASE_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas']);

export function capitalizeName(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Formats a location string: trims, fixes spacing around commas/punctuation,
 * removes duplicate commas, and capitalizes each segment.
 * e.g. "Pinhais, Piraquara , São José , E região" → "Pinhais, Piraquara, São José e região"
 */
export function formatLocationString(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/, E /gi, ' e ')
    .trim();
}
