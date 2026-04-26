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
  slug?: string | null;
  city?: string | null;
}

/**
 * Resolution priority:
 *  1. Profile full_name (real verified name)
 *  2. provider.name (already resolved upstream — but only if not generic)
 *  3. business_name (only if not generic)
 *  4. Humanized slug
 *  5. "Profissional em {city}" or "Profissional"
 */
export function resolveDisplayName(input: ResolveDisplayNameInput): string {
  const candidates = [input.profileFullName, input.providerName, input.businessName];
  for (const c of candidates) {
    const v = (c || '').trim();
    if (v && !isGenericProviderName(v)) return v;
  }
  const fromSlug = humanizeProviderSlug(input.slug);
  if (fromSlug) return fromSlug;
  return input.city ? `Profissional em ${input.city}` : 'Profissional';
}

export interface ResolveAvatarInput {
  profileAvatarUrl?: string | null;
  providerPhotoUrl?: string | null;
  serviceImage?: string | null;
  /** Stable seed used by DiceBear when nothing else is available. */
  seed?: string | null;
  /** Style for the generated DiceBear avatar — defaults to "adventurer". */
  fallbackStyle?: string;
}

/**
 * Resolution priority for avatar:
 *  1. public_profiles.avatar_url (real selfie / official photo)
 *  2. providers.photo_url (uploaded by provider)
 *  3. service image (first service portfolio image)
 *  4. Generated DiceBear avatar (deterministic via seed)
 */
export function resolveAvatarUrl(input: ResolveAvatarInput): string {
  const profile = (input.profileAvatarUrl || '').trim();
  if (profile) return profile;
  const photo = (input.providerPhotoUrl || '').trim();
  if (photo) return photo;
  const svc = (input.serviceImage || '').trim();
  if (svc) return svc;
  const style = input.fallbackStyle || 'adventurer';
  const seed = encodeURIComponent(input.seed || 'profissional');
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
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
