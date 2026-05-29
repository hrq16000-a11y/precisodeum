/**
 * Centralized helpers for resolving the *displayed* name and avatar of a
 * provider card across the entire app (home Featured, Nearby feed, search,
 * profile cards, etc.).
 *
 * Goals:
 * 1. Never show category-style words ("Pedreiro", "Eletricista", "Autônomo")
 *    as a person's name. These leak from `business_name` for self-employed
 *    providers who fill the field with their profession.
 * 2. Always prefer the verified profile data (full_name + avatar_url) coming
 *    from `public_profiles` over the raw provider fields.
 * 3. Provide a single source of truth so future changes only happen in ONE
 *    place — keeping all feeds visually consistent.
 */

const GENERIC_PROVIDER_NAME_TOKENS = new Set([
  'pedreiro', 'padeiro', 'padreiro', 'eletricista', 'encanador', 'pintor',
  'autonomo', 'autonoma', 'profissional', 'empreiteiro', 'marceneiro',
  'jardineiro', 'tecnico', 'tecnica', 'mecanico', 'mecanica',
  'servicosgerais', 'diarista', 'cozinheiro', 'cozinheira', 'motorista',
  'soldador', 'vidraceiro', 'gesseiro', 'azulejista', 'prestador',
  'prestadora', 'profissionalautonomo', 'servico', 'servicos',
  'pintora', 'eletricidade', 'hidraulica', 'reformas', 'reforma',
  'construcao', 'construtor', 'construtora', 'manutencao',
]);

export const normalizeProviderToken = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

export const isGenericProviderName = (s?: string | null): boolean => {
  if (!s) return true;
  const norm = normalizeProviderToken(s);
  if (!norm) return true;
  if (GENERIC_PROVIDER_NAME_TOKENS.has(norm)) return true;
  // Defensive: "profissional em XYZ" pattern
  if (/^profissional(em|de)/.test(norm)) return true;
  return false;
};

export const humanizeProviderSlug = (slug?: string | null): string => {
  if (!slug) return '';
  const base = slug
    .replace(/-[a-f0-9]{6,}$/i, '')
    .replace(/\b\d+\b/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || isGenericProviderName(base)) return '';
  return base
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export interface ResolveDisplayNameInput {
  profileFullName?: string | null;
  providerName?: string | null;
  businessName?: string | null;
  legalName?: string | null;
  slug?: string | null;
  city?: string | null;
  /** When 'company', business/legal name takes priority over profile full_name. */
  accountType?: string | null;
}

/**
 * Resolution priority:
 *  - PJ (company): business_name → legal_name → profile full_name → slug → city
 *  - PF (default): profile full_name → providerName → business_name → slug → city
 */
export function resolveDisplayName(input: ResolveDisplayNameInput): string {
  const isCompany = (input.accountType || '').toLowerCase() === 'company';
  const candidates = isCompany
    ? [input.businessName, input.legalName, input.profileFullName, input.providerName]
    : [input.profileFullName, input.providerName, input.businessName, input.legalName];
  for (const c of candidates) {
    const v = (c || '').trim();
    // Para PJ, business_name é o nome oficial — não aplicamos filtro de "genérico".
    if (v && (isCompany || !isGenericProviderName(v))) return v;
  }
  const fromSlug = humanizeProviderSlug(input.slug);
  if (fromSlug) return fromSlug;
  return input.city ? `Profissional em ${input.city}` : 'Profissional';
}

export interface ResolveAvatarInput {
  profileAvatarUrl?: string | null;
  providerPhotoUrl?: string | null;
  /** Single service cover image (back-compat). */
  serviceImage?: string | null;
  /** Pool of portfolio/service images. When no real avatar exists, one is
   *  picked deterministically by `seed` so the fallback feels personal but
   *  remains stable across renders. */
  portfolioImages?: Array<string | null | undefined> | null;
  /** Stable seed used to pick a consistent fallback color / portfolio image. */
  seed?: string | null;
  /** Display name — used to derive initials for the professional fallback. */
  name?: string | null;
  /** @deprecated kept for backward-compat; no longer used (DiceBear removed). */
  fallbackStyle?: string;
}

// Curated palette of professional, muted backgrounds for initials avatars.
const INITIALS_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: '#1e3a8a', fg: '#ffffff' },
  { bg: '#0f766e', fg: '#ffffff' },
  { bg: '#7c2d12', fg: '#ffffff' },
  { bg: '#4338ca', fg: '#ffffff' },
  { bg: '#166534', fg: '#ffffff' },
  { bg: '#9a3412', fg: '#ffffff' },
  { bg: '#334155', fg: '#ffffff' },
  { bg: '#155e75', fg: '#ffffff' },
  { bg: '#854d0e', fg: '#ffffff' },
  { bg: '#6b21a8', fg: '#ffffff' },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extractInitials(name?: string | null, seed?: string | null): string {
  const src = (name || '').trim();
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean)
      .filter((w, i, arr) => i === 0 || i === arr.length - 1 || w[0] === w[0]?.toUpperCase());
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const fallback = (seed || '').replace(/[^a-zA-Z0-9]/g, '');
  return (fallback.slice(0, 2) || 'PR').toUpperCase();
}

// Lightweight detection — avoids picking a video file as static avatar.
const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|ogv|avi|mkv)(\?|#|$)/i;
const isLikelyImage = (u?: string | null): u is string => {
  const v = (u || '').trim();
  if (!v) return false;
  if (v.startsWith('data:image/')) return true;
  if (VIDEO_EXT_RE.test(v)) return false;
  // YouTube/Vimeo and other video providers — skip.
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(v)) return false;
  return true;
};

/**
 * Resolution priority for avatar:
 *  1. public_profiles.avatar_url (real selfie / official photo)
 *  2. providers.photo_url (uploaded by provider)
 *  3. A deterministically-picked image from portfolioImages / serviceImage
 *     (random-feeling but stable per provider)
 *  4. Professional initials SVG (deterministic color from seed)
 */
export function resolveAvatarUrl(input: ResolveAvatarInput): string {
  const profile = (input.profileAvatarUrl || '').trim();
  if (profile) return profile;
  const photo = (input.providerPhotoUrl || '').trim();
  if (photo) return photo;

  const seedStr = String(input.seed || input.name || 'profissional');

  // Build pool: explicit portfolio array first, then the legacy single serviceImage.
  const pool: string[] = [];
  if (Array.isArray(input.portfolioImages)) {
    for (const u of input.portfolioImages) if (isLikelyImage(u)) pool.push(u as string);
  }
  if (isLikelyImage(input.serviceImage)) pool.push(input.serviceImage as string);

  if (pool.length > 0) {
    // Deterministic pick: same provider always sees the same fallback image,
    // but different providers get different ones — "random-feeling" in feeds.
    const idx = hashString(seedStr) % pool.length;
    return pool[idx];
  }

  const palette = INITIALS_PALETTE[hashString(seedStr) % INITIALS_PALETTE.length];
  const initials = extractInitials(input.name, seedStr);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${palette.bg}"/><text x="50%" y="50%" dy=".1em" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="88" font-weight="600" fill="${palette.fg}" letter-spacing="-2">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}


/** True when avatar comes from the user (not generated). Useful for badges. */
export function hasRealAvatar(input: Pick<ResolveAvatarInput, 'profileAvatarUrl' | 'providerPhotoUrl' | 'serviceImage'>): boolean {
  return !!(input.profileAvatarUrl?.trim() || input.providerPhotoUrl?.trim() || input.serviceImage?.trim());
}

/** Decide whether the category label would visually duplicate the name. */
export function isDuplicateCategoryLabel(displayName?: string | null, category?: string | null, businessName?: string | null): boolean {
  const nameNorm = normalizeProviderToken(displayName || '');
  const categoryNorm = normalizeProviderToken(category || '');
  const businessNorm = normalizeProviderToken(businessName || '');
  if (!categoryNorm) return false;
  return (
    categoryNorm === nameNorm ||
    categoryNorm === businessNorm ||
    (!!nameNorm && (nameNorm.includes(categoryNorm) || categoryNorm.includes(nameNorm))) ||
    (!!businessNorm && (businessNorm.includes(categoryNorm) || categoryNorm.includes(businessNorm)))
  );
}
