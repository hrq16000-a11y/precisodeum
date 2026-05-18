/**
 * Temporary read-resolution layer for profile/provider dual-source data.
 *
 * Persistence is still dual-source (profiles + providers) until a future
 * consolidation. This module exists ONLY to standardize how the UI READS
 * those fields so every screen resolves the same way.
 *
 * Rules:
 *  - Pure functions, no side effects.
 *  - Do NOT call from save/update/payload code — read-only consolidation.
 *  - Priority is explicit and documented per resolver.
 *  - Inputs are loose-typed records to accept the many shapes already in use
 *    (profile from `public_profiles`, provider from `providers`, sometimes
 *    nested under `svc.provider`, etc.).
 */

export type LooseRecord = Record<string, any> | null | undefined;

const pickString = (...candidates: Array<unknown>): string => {
  for (const c of candidates) {
    if (typeof c === 'string') {
      const v = c.trim();
      if (v) return v;
    }
  }
  return '';
};

/**
 * WhatsApp — priority:
 *   provider.whatsapp → profile.whatsapp → provider.phone → profile.phone
 *
 * Rationale: provider record is the actionable contact for service flows;
 * phone is a legacy fallback. Returns digits/raw string as stored (no
 * normalization here — caller may pass through `toCanonical` from
 * `@/lib/whatsapp` if a link is needed).
 */
export const resolveWhatsapp = (provider: LooseRecord, profile: LooseRecord): string =>
  pickString(provider?.whatsapp, profile?.whatsapp, provider?.phone, profile?.phone);

/**
 * Phone — priority:
 *   provider.phone → profile.phone → provider.whatsapp → profile.whatsapp
 */
export const resolvePhone = (provider: LooseRecord, profile: LooseRecord): string =>
  pickString(provider?.phone, profile?.phone, provider?.whatsapp, profile?.whatsapp);

/**
 * Display name — priority:
 *   profile.full_name → provider.business_name → provider.legal_name
 *
 * Use this only for generic "Olá, {nome}" type reads. Card/listing
 * rendering with PJ/PF disambiguation should keep using
 * `@/lib/providerDisplay#resolveDisplayName` which handles account-type
 * rules and generic-name filtering.
 */
export const resolveDisplayName = (provider: LooseRecord, profile: LooseRecord): string =>
  pickString(profile?.full_name, provider?.business_name, provider?.legal_name);

/**
 * Avatar URL — priority:
 *   profile.avatar_url → provider.photo_url
 *
 * Profile avatar is the user's verified self-image; provider photo is a
 * fallback when the user uploaded only on the business side.
 */
export const resolveAvatar = (provider: LooseRecord, profile: LooseRecord): string =>
  pickString(profile?.avatar_url, provider?.photo_url);

/**
 * City — priority:
 *   provider.city → profile.city
 *
 * Provider city wins because it is the service-area canonical source.
 */
export const resolveCity = (provider: LooseRecord, profile: LooseRecord): string =>
  pickString(provider?.city, profile?.city);

/**
 * Convenience: true when any contact channel resolves to a non-empty value.
 */
export const hasAnyContact = (provider: LooseRecord, profile: LooseRecord): boolean =>
  !!resolveWhatsapp(provider, profile) || !!resolvePhone(provider, profile);
