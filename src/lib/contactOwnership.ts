/**
 * Fase 1.6.6 — Contact ownership boundary (semantic only).
 *
 * Provider accounts own provider contact fields.
 * Profile contact fields remain compatibility mirrors.
 *
 * This module is intentionally NON-MUTATING. It does NOT remove dual-writes,
 * it does NOT alter the read resolver, and it does NOT change schema/RLS.
 * Its purpose is to formalize the architectural intent so future call-sites
 * (and the future consolidation RPC) have a single source of truth for who
 * owns phone/whatsapp.
 *
 * Read priority continues to follow `@/lib/profileResolvers` (already shipped
 * in Fase 1.5). Normalization continues to follow
 * `@/lib/validation/phoneNormalization` (Fase 1.3).
 *
 * Companion: `logSyncFailure` from `@/lib/multiWriteSync` is reused for
 * partial-failure observability; `contact_ownership_conflict` is emitted via
 * `logAuditAction` (see `useAuditLog`) when a divergence is detected.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import { normalizePhoneBR } from '@/lib/validation/phoneNormalization';

export type ProfileType = 'client' | 'provider' | 'rh' | string | null | undefined;
export type ContactOwner = 'profile' | 'provider';
export type ContactField = 'phone' | 'whatsapp';

/**
 * Returns the canonical owner table for a given profile type.
 *  - provider / rh → providers
 *  - client (and any non-provider) → profiles
 */
export function resolveContactOwner(profileType: ProfileType): ContactOwner {
  if (profileType === 'provider' || profileType === 'rh') return 'provider';
  return 'profile';
}

/**
 * Should we write the contact field into `profiles`?
 * - Clients: yes (canonical).
 * - Providers: yes, but as a compatibility mirror only.
 *
 * Kept as a permissive helper so legacy dual-write call-sites do NOT regress.
 * Callers may opt-out of the mirror by passing `{ mirrorForProvider: false }`.
 */
export function shouldWriteProfileContact(
  profileType: ProfileType,
  opts: { mirrorForProvider?: boolean } = {},
): boolean {
  const owner = resolveContactOwner(profileType);
  if (owner === 'profile') return true;
  return opts.mirrorForProvider !== false;
}

/**
 * Should we write the contact field into `providers`?
 * Only when the user is a provider/rh. Clients MUST NOT write provider fields.
 */
export function shouldWriteProviderContact(profileType: ProfileType): boolean {
  return resolveContactOwner(profileType) === 'provider';
}

/**
 * Returns the canonical source table for reads of phone/whatsapp.
 * Mirrors `profileResolvers` priority but expressed as ownership semantics:
 *   provider → providers; client → profiles.
 */
export function getCanonicalContactSource(profileType: ProfileType): ContactOwner {
  return resolveContactOwner(profileType);
}

/**
 * Detects a "significant divergence" between profile and provider contact
 * fields for a provider account. We normalize both sides via `normalizePhoneBR`
 * so cosmetic differences (mask, +55, spaces) are ignored.
 *
 * Returns the field name when divergent, or null. Empty-vs-set is also
 * considered divergent (compatibility mirror missing).
 */
export function detectContactConflict(
  profileType: ProfileType,
  field: ContactField,
  profileValue: unknown,
  providerValue: unknown,
): { conflict: boolean; profileHasValue: boolean; providerHasValue: boolean } {
  const owner = resolveContactOwner(profileType);
  const p = normalizePhoneBR(profileValue);
  const v = normalizePhoneBR(providerValue);
  const profileHasValue = p.length > 0;
  const providerHasValue = v.length > 0;
  if (owner !== 'provider') {
    return { conflict: false, profileHasValue, providerHasValue };
  }
  // For providers: divergent if both present and differ, OR if provider (owner)
  // is empty while profile has data (means owner table never got the value).
  const conflict =
    (profileHasValue && providerHasValue && p !== v) ||
    (!providerHasValue && profileHasValue);
  return { conflict, profileHasValue, providerHasValue };
}

export interface LogContactConflictOpts {
  source: string; // call-site id (no PII)
  profileType: ProfileType;
  field: ContactField;
  profileValue: unknown;
  providerValue: unknown;
}

/**
 * Emits `contact_ownership_conflict` to audit_log when a provider account
 * shows a meaningful divergence between profile and provider contact fields.
 *
 * Fail-soft: never throws, never logs PII (booleans + field name only).
 */
export async function maybeLogContactOwnershipConflict(
  opts: LogContactConflictOpts,
): Promise<void> {
  try {
    const { conflict, profileHasValue, providerHasValue } = detectContactConflict(
      opts.profileType,
      opts.field,
      opts.profileValue,
      opts.providerValue,
    );
    if (!conflict) return;
    await logAuditAction({
      action: 'contact_ownership_conflict' as any,
      resource_type: 'contact_ownership',
      details: {
        source: opts.source,
        profile_type: opts.profileType ?? null,
        field: opts.field,
        profile_has_value: profileHasValue,
        provider_has_value: providerHasValue,
      },
    });
  } catch {
    /* fail-soft */
  }
}
