/**
 * Fase 1.7.1 — Drift detection catalog (observability-only).
 *
 * Catálogo oficial de tipos de inconsistência entre profiles, providers,
 * onboarding flags, mirrors e progress. NÃO contém detectores nem writes —
 * apenas a definição estrutural.
 *
 * `reconciliation_strategy` e `auto_fixable` são reservados para fases
 * futuras (reconciliation real). Hoje, todos `auto_fixable=false`.
 */

export type DriftSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type DriftOwner = 'profile' | 'provider' | 'mixed' | 'system';
export type CanonicalSource =
  | 'profiles'
  | 'providers'
  | 'profiles.avatar_url'
  | 'providers.photo_url'
  | 'providers.onboarding_progress'
  | 'profiles.profile_type'
  | 'providers.status'
  | 'providers.city'
  | 'profiles.city'
  | 'none';

export type ReconciliationStrategy =
  | 'mirror_from_canonical'
  | 'promote_to_canonical'
  | 'create_missing_provider'
  | 'detach_orphan'
  | 'normalize_value'
  | 'manual_review'
  | 'none';

export type DriftType =
  | 'CONTACT_MISMATCH'
  | 'AVATAR_MISMATCH'
  | 'PROFILE_TYPE_WITHOUT_PROVIDER'
  | 'PROVIDER_WITHOUT_PROFILE'
  | 'ONBOARDING_FLAG_MISMATCH'
  | 'PROVIDER_STATUS_MISMATCH'
  | 'CITY_MISMATCH'
  | 'ONBOARDING_PROGRESS_MISMATCH'
  | 'ORPHAN_PROVIDER'
  | 'ORPHAN_PROFILE'
  | 'INVALID_MIRROR'
  | 'UNKNOWN';

export interface DriftTypeDefinition {
  type: DriftType;
  severity: DriftSeverity;
  owner: DriftOwner;
  canonical_source: CanonicalSource;
  reconciliation_strategy: ReconciliationStrategy;
  /** Reservado para fases futuras — sempre false na 1.7.1. */
  auto_fixable: boolean;
  /** Boundary client-side que produz/possui este tipo de drift. */
  affected_boundary:
    | 'multiWriteSync'
    | 'avatarSync'
    | 'onboardingProgressSync'
    | 'adminWriteBoundary'
    | 'inline_call_site'
    | 'none';
}

export const DRIFT_CATALOG: Readonly<Record<DriftType, DriftTypeDefinition>> = {
  CONTACT_MISMATCH: {
    type: 'CONTACT_MISMATCH',
    severity: 'medium',
    owner: 'provider',
    canonical_source: 'providers',
    reconciliation_strategy: 'mirror_from_canonical',
    auto_fixable: false,
    affected_boundary: 'multiWriteSync',
  },
  AVATAR_MISMATCH: {
    type: 'AVATAR_MISMATCH',
    severity: 'low',
    owner: 'profile',
    canonical_source: 'profiles.avatar_url',
    reconciliation_strategy: 'mirror_from_canonical',
    auto_fixable: false,
    affected_boundary: 'avatarSync',
  },
  PROFILE_TYPE_WITHOUT_PROVIDER: {
    type: 'PROFILE_TYPE_WITHOUT_PROVIDER',
    severity: 'high',
    owner: 'mixed',
    canonical_source: 'profiles.profile_type',
    reconciliation_strategy: 'create_missing_provider',
    auto_fixable: false,
    affected_boundary: 'multiWriteSync',
  },
  PROVIDER_WITHOUT_PROFILE: {
    type: 'PROVIDER_WITHOUT_PROFILE',
    severity: 'critical',
    owner: 'system',
    canonical_source: 'profiles',
    reconciliation_strategy: 'detach_orphan',
    auto_fixable: false,
    affected_boundary: 'none',
  },
  ONBOARDING_FLAG_MISMATCH: {
    type: 'ONBOARDING_FLAG_MISMATCH',
    severity: 'medium',
    owner: 'mixed',
    canonical_source: 'profiles',
    reconciliation_strategy: 'manual_review',
    auto_fixable: false,
    affected_boundary: 'multiWriteSync',
  },
  PROVIDER_STATUS_MISMATCH: {
    type: 'PROVIDER_STATUS_MISMATCH',
    severity: 'medium',
    owner: 'provider',
    canonical_source: 'providers.status',
    reconciliation_strategy: 'manual_review',
    auto_fixable: false,
    affected_boundary: 'adminWriteBoundary',
  },
  CITY_MISMATCH: {
    type: 'CITY_MISMATCH',
    severity: 'low',
    owner: 'provider',
    canonical_source: 'providers.city',
    reconciliation_strategy: 'mirror_from_canonical',
    auto_fixable: false,
    affected_boundary: 'multiWriteSync',
  },
  ONBOARDING_PROGRESS_MISMATCH: {
    type: 'ONBOARDING_PROGRESS_MISMATCH',
    severity: 'low',
    owner: 'provider',
    canonical_source: 'providers.onboarding_progress',
    reconciliation_strategy: 'manual_review',
    auto_fixable: false,
    affected_boundary: 'onboardingProgressSync',
  },
  ORPHAN_PROVIDER: {
    type: 'ORPHAN_PROVIDER',
    severity: 'critical',
    owner: 'system',
    canonical_source: 'profiles',
    reconciliation_strategy: 'detach_orphan',
    auto_fixable: false,
    affected_boundary: 'none',
  },
  ORPHAN_PROFILE: {
    type: 'ORPHAN_PROFILE',
    severity: 'info',
    owner: 'system',
    canonical_source: 'profiles',
    reconciliation_strategy: 'none',
    auto_fixable: false,
    affected_boundary: 'none',
  },
  INVALID_MIRROR: {
    type: 'INVALID_MIRROR',
    severity: 'medium',
    owner: 'mixed',
    canonical_source: 'none',
    reconciliation_strategy: 'normalize_value',
    auto_fixable: false,
    affected_boundary: 'multiWriteSync',
  },
  UNKNOWN: {
    type: 'UNKNOWN',
    severity: 'info',
    owner: 'system',
    canonical_source: 'none',
    reconciliation_strategy: 'manual_review',
    auto_fixable: false,
    affected_boundary: 'none',
  },
};

const SEVERITY_RANK: Record<DriftSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function compareSeverity(a: DriftSeverity, b: DriftSeverity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

export function maxSeverity(severities: DriftSeverity[]): DriftSeverity {
  if (severities.length === 0) return 'info';
  return severities.reduce((acc, s) => (compareSeverity(s, acc) > 0 ? s : acc), 'info' as DriftSeverity);
}
