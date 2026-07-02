/**
 * Sanitize text into a URL-safe slug.
 * - Removes accents (NFD + strip combining marks)
 * - Decodes URI-encoded chars (%C3 etc)
 * - Lowercases
 * - Replaces spaces/underscores with hyphens
 * - Strips invalid chars
 * - Collapses multiple hyphens
 * - Trims leading/trailing hyphens
 */
export function sanitizeSlug(text: string): string {
  if (!text) return '';

  let slug = text;

  // Decode any URI encoding first
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // already decoded or malformed — continue
  }

  return slug
    .normalize('NFD')                    // decompose accents
    .replace(/[\u0300-\u036f]/g, '')     // strip combining marks
    .toLowerCase()
    .replace(/[_\s]+/g, '-')            // spaces/underscores → hyphen
    .replace(/[^a-z0-9-]/g, '')         // remove invalid chars
    .replace(/-{2,}/g, '-')             // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');           // trim leading/trailing hyphens
}

/**
 * Generate provider slug from the strongest available business identity.
 * Preference:
 * 1. full name + business name + city
 * 2. full name + city
 * 3. business name + city
 * 4. full name
 * 5. business name
 */
export function generateProviderSlug(fullName: string, businessName = '', city = ''): string {
  const primaryParts = [fullName, businessName, city].map((part) => part.trim()).filter(Boolean);

  if (primaryParts.length > 0) {
    return sanitizeSlug(primaryParts.join(' '));
  }

  return 'profissional';
}

export function buildProviderSlugCandidates(slug: string): string[] {
  const raw = slug?.trim();
  if (!raw) return [];

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const normalized = sanitizeSlug(decoded);
  const candidates = new Set<string>([raw, decoded, normalized]);

  if (normalized.includes('--')) {
    candidates.add(normalized.replace(/-{2,}/g, '-'));
  }

  return Array.from(candidates).filter(Boolean);
}
