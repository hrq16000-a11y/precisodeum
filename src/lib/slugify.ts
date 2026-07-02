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

// Alias retrocompatível
export const slugify = sanitizeSlug;

/**
 * Sanitize + validate a slug for admin-managed entities
 * (categories, cities, services, institutional pages, blog posts).
 *
 * Regras:
 *  - lower kebab-case (via sanitizeSlug)
 *  - min 2 / max 80 chars
 *  - deve começar com [a-z0-9]
 *  - não pode ser reservado (admin, api, auth, dashboard, etc.)
 */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'auth', 'dashboard', 'login', 'logout', 'signup',
  'cadastro', 'perfil', 'profissional', 'empresa', 'buscar',
  'sponsor-panel', 'lovable', 'assets', 'static', 'public',
  'null', 'undefined', 'true', 'false',
]);

export interface AdminSlugResult {
  ok: boolean;
  slug: string;
  error?: string;
}

export function sanitizeAdminSlug(
  input: string,
  opts?: { minLen?: number; maxLen?: number },
): AdminSlugResult {
  const minLen = opts?.minLen ?? 2;
  const maxLen = opts?.maxLen ?? 80;
  const slug = sanitizeSlug(input);

  if (!slug) return { ok: false, slug: '', error: 'Slug vazio após normalização.' };
  if (slug.length < minLen) return { ok: false, slug, error: `Slug muito curto (mínimo ${minLen}).` };
  if (slug.length > maxLen) return { ok: false, slug, error: `Slug muito longo (máximo ${maxLen}).` };
  if (!/^[a-z0-9]/.test(slug)) return { ok: false, slug, error: 'Slug deve começar com letra ou número.' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, slug, error: `"${slug}" é um slug reservado.` };

  return { ok: true, slug };
}


