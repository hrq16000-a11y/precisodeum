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
 * Generate provider slug from name + city.
 */
export function generateProviderSlug(name: string, city: string): string {
  const raw = `${name} ${city}`;
  return sanitizeSlug(raw);
}
