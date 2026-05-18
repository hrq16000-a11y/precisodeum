/**
 * Fase 1.7.1 — Drift detectors (pure, read-only).
 *
 * Recebem snapshots normalizados de profile/provider e retornam um relatório
 * estrutural de divergências. NÃO escrevem em banco. NÃO corrigem nada.
 *
 * Ownership alinhada à Fase 1.6.6 (contactOwnership) e leitura alinhada aos
 * resolvers da 1.5. Mirrors de avatar/progress respeitam 1.6.4 / 1.6.5.
 */

import {
  detectContactConflict,
  resolveContactOwner,
  type ContactField,
  type ProfileType,
} from '@/lib/contactOwnership';
import {
  DRIFT_CATALOG,
  maxSeverity,
  type CanonicalSource,
  type DriftSeverity,
  type DriftType,
  type ReconciliationStrategy,
} from './driftTypes';

export type LooseRecord = Record<string, any> | null | undefined;

export interface DriftFinding {
  type: DriftType;
  severity: DriftSeverity;
  canonical_source: CanonicalSource;
  reconciliation_strategy: ReconciliationStrategy;
  affected_boundary: string;
  /** Sub-código opcional para granularidade (ex: 'phone', 'whatsapp'). */
  subject?: string;
  /** Sinalizadores PII-free para diagnóstico. */
  signals?: Record<string, boolean | string | number | null>;
}

export interface DriftReport {
  hasDrift: boolean;
  drifts: DriftFinding[];
  severity: DriftSeverity;
  canonicalOwner: 'profile' | 'provider' | 'none';
  reconciliationHints: ReconciliationStrategy[];
}

function emptyReport(canonicalOwner: 'profile' | 'provider' | 'none' = 'none'): DriftReport {
  return {
    hasDrift: false,
    drifts: [],
    severity: 'info',
    canonicalOwner,
    reconciliationHints: [],
  };
}

function finding(type: DriftType, extra: Partial<DriftFinding> = {}): DriftFinding {
  const def = DRIFT_CATALOG[type];
  return {
    type,
    severity: def.severity,
    canonical_source: def.canonical_source,
    reconciliation_strategy: def.reconciliation_strategy,
    affected_boundary: def.affected_boundary,
    ...extra,
  };
}

const norm = (v: unknown): string =>
  typeof v === 'string' ? v.trim().toLowerCase() : v == null ? '' : String(v).trim().toLowerCase();

// ---------------------------------------------------------------------------
// Contact drift
// ---------------------------------------------------------------------------
export function detectContactDrift(
  profileType: ProfileType,
  profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  // Cliente puro sem provider não é drift (mirror inexistente é esperado).
  const owner = resolveContactOwner(profileType);
  if (owner !== 'provider') return [];
  if (!provider) return [];
  const out: DriftFinding[] = [];
  for (const field of ['phone', 'whatsapp'] as ContactField[]) {
    const r = detectContactConflict(
      profileType,
      field,
      profile?.[field],
      provider?.[field],
    );
    if (r.conflict) {
      out.push(
        finding('CONTACT_MISMATCH', {
          subject: field,
          signals: {
            profile_has_value: r.profileHasValue,
            provider_has_value: r.providerHasValue,
          },
        }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Avatar drift — profile.avatar_url é canonical; provider.photo_url é mirror.
// ---------------------------------------------------------------------------
export function detectAvatarDrift(
  profileType: ProfileType,
  profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  const owner = resolveContactOwner(profileType);
  if (owner !== 'provider') return [];
  if (!provider) return [];
  const canonical = norm(profile?.avatar_url);
  const mirror = norm(provider?.photo_url);
  if (!canonical && !mirror) return [];
  // Mirror desatualizado ou divergente.
  if (canonical !== mirror) {
    return [
      finding('AVATAR_MISMATCH', {
        signals: {
          canonical_present: canonical.length > 0,
          mirror_present: mirror.length > 0,
        },
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Onboarding flag drift — profiles.onboarding_completed vs providers state.
// ---------------------------------------------------------------------------
export function detectOnboardingDrift(
  profileType: ProfileType,
  profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  const owner = resolveContactOwner(profileType);
  if (owner !== 'provider' || !provider) return [];
  const completed = profile?.onboarding_completed === true;
  const providerOnboarding =
    provider?.onboarding_completed === true ||
    provider?.onboarding_finished_at != null;
  if (completed !== providerOnboarding) {
    return [
      finding('ONBOARDING_FLAG_MISMATCH', {
        signals: {
          profile_completed: completed,
          provider_completed: providerOnboarding,
        },
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Provider ownership drift — profile_type=provider/rh sem provider record.
// ---------------------------------------------------------------------------
export function detectProviderOwnershipDrift(
  profileType: ProfileType,
  profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  const isProviderType = profileType === 'provider' || profileType === 'rh';
  const out: DriftFinding[] = [];
  if (isProviderType && !provider) {
    out.push(
      finding('PROFILE_TYPE_WITHOUT_PROVIDER', {
        signals: { profile_type: (profileType as string) ?? null },
      }),
    );
  }
  if (!isProviderType && provider) {
    // provider record existe sem profile_type compatível
    out.push(
      finding('INVALID_MIRROR', {
        subject: 'profile_type_provider_mismatch',
        signals: { profile_type: (profileType as string) ?? null, provider_present: true },
      }),
    );
  }
  if (provider && !profile) {
    out.push(finding('PROVIDER_WITHOUT_PROFILE'));
    out.push(finding('ORPHAN_PROVIDER'));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Onboarding progress JSONB shape drift.
// ---------------------------------------------------------------------------
export function detectProgressDrift(
  profileType: ProfileType,
  _profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  const owner = resolveContactOwner(profileType);
  if (owner !== 'provider' || !provider) return [];
  const prog = provider?.onboarding_progress;
  if (prog == null) return [];
  if (typeof prog !== 'object' || Array.isArray(prog)) {
    return [
      finding('ONBOARDING_PROGRESS_MISMATCH', {
        signals: { shape: Array.isArray(prog) ? 'array' : typeof prog },
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Provider status drift — profile is provider but status is null/inactive
// while onboarding is completed.
// ---------------------------------------------------------------------------
export function detectStatusDrift(
  profileType: ProfileType,
  profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  if (!provider) return [];
  const owner = resolveContactOwner(profileType);
  if (owner !== 'provider') return [];
  const completed = profile?.onboarding_completed === true;
  const status = norm(provider?.status);
  if (completed && status && status !== 'active' && status !== 'approved' && status !== 'pending') {
    return [
      finding('PROVIDER_STATUS_MISMATCH', {
        signals: { status_present: status.length > 0 },
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// City mirror drift — providers.city canonical, profiles.city is mirror.
// ---------------------------------------------------------------------------
export function detectCityDrift(
  profileType: ProfileType,
  profile: LooseRecord,
  provider: LooseRecord,
): DriftFinding[] {
  const owner = resolveContactOwner(profileType);
  if (owner !== 'provider' || !provider) return [];
  const canonical = norm(provider?.city);
  const mirror = norm(profile?.city);
  if (!canonical || !mirror) return [];
  if (canonical !== mirror) {
    return [
      finding('CITY_MISMATCH', {
        signals: {
          canonical_present: canonical.length > 0,
          mirror_present: mirror.length > 0,
        },
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Aggregate.
// ---------------------------------------------------------------------------
export interface DetectAllInput {
  profileType: ProfileType;
  profile: LooseRecord;
  provider: LooseRecord;
}

export function detectAllDrifts(input: DetectAllInput): DriftReport {
  const { profileType, profile, provider } = input;
  const owner: 'profile' | 'provider' | 'none' =
    !profile && !provider
      ? 'none'
      : resolveContactOwner(profileType) === 'provider'
        ? 'provider'
        : 'profile';

  const drifts: DriftFinding[] = [
    ...detectProviderOwnershipDrift(profileType, profile, provider),
    ...detectContactDrift(profileType, profile, provider),
    ...detectAvatarDrift(profileType, profile, provider),
    ...detectOnboardingDrift(profileType, profile, provider),
    ...detectProgressDrift(profileType, profile, provider),
    ...detectStatusDrift(profileType, profile, provider),
    ...detectCityDrift(profileType, profile, provider),
  ];

  return {
    hasDrift: drifts.length > 0,
    drifts,
    severity: maxSeverity(drifts.map((d) => d.severity)),
    canonicalOwner: owner,
    reconciliationHints: Array.from(new Set(drifts.map((d) => d.reconciliation_strategy))),
  };
}
