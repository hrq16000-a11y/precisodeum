/**
 * Fase 1.7.1 — Drift registry + observability bridge.
 *
 * Centraliza:
 *  - registro dos detectores oficiais
 *  - integração com operationRegistry (1.7.0): cada flow declara seu
 *    potencial de drift, dependência de mirror e necessidade de sync.
 *  - emissão padronizada de `drift_detected` / `drift_detection_failed` /
 *    `reconciliation_blocked` (sem PII).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import {
  detectAllDrifts,
  detectAvatarDrift,
  detectCityDrift,
  detectContactDrift,
  detectOnboardingDrift,
  detectProgressDrift,
  detectProviderOwnershipDrift,
  detectStatusDrift,
  type DetectAllInput,
  type DriftFinding,
  type DriftReport,
} from './detectDrift';
import {
  DRIFT_CATALOG,
  type DriftType,
} from './driftTypes';

export type DetectorId =
  | 'contact'
  | 'avatar'
  | 'onboarding'
  | 'provider_ownership'
  | 'progress'
  | 'status'
  | 'city';

export interface DetectorEntry {
  id: DetectorId;
  produces: DriftType[];
  /** Pure function reference — kept loose to avoid coupling signatures. */
  run: (input: DetectAllInput) => DriftFinding[];
}

export const DRIFT_DETECTORS: readonly DetectorEntry[] = [
  {
    id: 'provider_ownership',
    produces: ['PROFILE_TYPE_WITHOUT_PROVIDER', 'PROVIDER_WITHOUT_PROFILE', 'ORPHAN_PROVIDER', 'INVALID_MIRROR'],
    run: ({ profileType, profile, provider }) =>
      detectProviderOwnershipDrift(profileType, profile, provider),
  },
  {
    id: 'contact',
    produces: ['CONTACT_MISMATCH'],
    run: ({ profileType, profile, provider }) =>
      detectContactDrift(profileType, profile, provider),
  },
  {
    id: 'avatar',
    produces: ['AVATAR_MISMATCH'],
    run: ({ profileType, profile, provider }) =>
      detectAvatarDrift(profileType, profile, provider),
  },
  {
    id: 'onboarding',
    produces: ['ONBOARDING_FLAG_MISMATCH'],
    run: ({ profileType, profile, provider }) =>
      detectOnboardingDrift(profileType, profile, provider),
  },
  {
    id: 'progress',
    produces: ['ONBOARDING_PROGRESS_MISMATCH'],
    run: ({ profileType, profile, provider }) =>
      detectProgressDrift(profileType, profile, provider),
  },
  {
    id: 'status',
    produces: ['PROVIDER_STATUS_MISMATCH'],
    run: ({ profileType, profile, provider }) =>
      detectStatusDrift(profileType, profile, provider),
  },
  {
    id: 'city',
    produces: ['CITY_MISMATCH'],
    run: ({ profileType, profile, provider }) =>
      detectCityDrift(profileType, profile, provider),
  },
] as const;

// ---------------------------------------------------------------------------
// Flow ↔ drift potential map (readiness integration).
// ---------------------------------------------------------------------------
export interface FlowDriftProfile {
  flow: FlowId;
  produces_drift_potential: DriftType[];
  depends_on_mirror: boolean;
  depends_on_eventual_sync: boolean;
}

export const FLOW_DRIFT_PROFILES: readonly FlowDriftProfile[] = [
  {
    flow: 'dashboard_profile_save',
    produces_drift_potential: ['CONTACT_MISMATCH', 'CITY_MISMATCH', 'INVALID_MIRROR'],
    depends_on_mirror: true,
    depends_on_eventual_sync: false,
  },
  {
    flow: 'persist_first_service',
    produces_drift_potential: ['ONBOARDING_FLAG_MISMATCH', 'ONBOARDING_PROGRESS_MISMATCH'],
    depends_on_mirror: false,
    depends_on_eventual_sync: true,
  },
  {
    flow: 'bet_finish_client',
    produces_drift_potential: ['ONBOARDING_FLAG_MISMATCH'],
    depends_on_mirror: false,
    depends_on_eventual_sync: false,
  },
  {
    flow: 'bet_finish_pro',
    produces_drift_potential: [
      'ONBOARDING_FLAG_MISMATCH',
      'ONBOARDING_PROGRESS_MISMATCH',
      'PROFILE_TYPE_WITHOUT_PROVIDER',
    ],
    depends_on_mirror: true,
    depends_on_eventual_sync: true,
  },
  {
    flow: 'profile_type_switch',
    produces_drift_potential: ['PROFILE_TYPE_WITHOUT_PROVIDER', 'INVALID_MIRROR'],
    depends_on_mirror: true,
    depends_on_eventual_sync: false,
  },
  {
    flow: 'avatar_sync',
    produces_drift_potential: ['AVATAR_MISMATCH'],
    depends_on_mirror: true,
    depends_on_eventual_sync: false,
  },
  {
    flow: 'onboarding_progress_sync',
    produces_drift_potential: ['ONBOARDING_PROGRESS_MISMATCH'],
    depends_on_mirror: false,
    depends_on_eventual_sync: true,
  },
  {
    flow: 'admin_profile_update',
    produces_drift_potential: ['CONTACT_MISMATCH', 'CITY_MISMATCH'],
    depends_on_mirror: true,
    depends_on_eventual_sync: false,
  },
  {
    flow: 'admin_provider_update',
    produces_drift_potential: ['PROVIDER_STATUS_MISMATCH', 'CITY_MISMATCH'],
    depends_on_mirror: true,
    depends_on_eventual_sync: false,
  },
] as const;

export function getFlowDriftProfile(flow: FlowId): FlowDriftProfile | undefined {
  return FLOW_DRIFT_PROFILES.find((f) => f.flow === flow);
}

/** Guard: garante que cada flow do registry possui um perfil de drift. */
export function assertFlowCoverage(): { ok: boolean; missing: FlowId[] } {
  const covered = new Set(FLOW_DRIFT_PROFILES.map((f) => f.flow));
  const missing = OPERATION_REGISTRY.map((r) => r.flow).filter((f) => !covered.has(f));
  return { ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Observability — PII-free emitters.
// ---------------------------------------------------------------------------
export interface DriftAuditContext {
  source: string;
  flow?: FlowId | null;
}

export async function logDriftDetected(
  ctx: DriftAuditContext,
  report: DriftReport,
): Promise<void> {
  if (!report.hasDrift) return;
  try {
    for (const d of report.drifts) {
      await logAuditAction({
        action: 'drift_detected' as any,
        resource_type: 'drift',
        details: {
          source: ctx.source,
          flow: ctx.flow ?? null,
          drift_type: d.type,
          severity: d.severity,
          ownership: DRIFT_CATALOG[d.type].owner,
          canonical_source: d.canonical_source,
          affected_boundary: d.affected_boundary,
          auto_fixable: DRIFT_CATALOG[d.type].auto_fixable,
          subject: d.subject ?? null,
          signals: d.signals ?? null,
        },
      });
    }
  } catch {
    /* fail-soft */
  }
}

export async function logDriftDetectionFailed(
  ctx: DriftAuditContext,
  errorCode: string,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'drift_detection_failed' as any,
      resource_type: 'drift',
      details: {
        source: ctx.source,
        flow: ctx.flow ?? null,
        error_code: errorCode,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logReconciliationBlocked(
  ctx: DriftAuditContext,
  driftType: DriftType,
  reason: string,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'reconciliation_blocked' as any,
      resource_type: 'drift',
      details: {
        source: ctx.source,
        flow: ctx.flow ?? null,
        drift_type: driftType,
        severity: DRIFT_CATALOG[driftType].severity,
        ownership: DRIFT_CATALOG[driftType].owner,
        canonical_source: DRIFT_CATALOG[driftType].canonical_source,
        affected_boundary: DRIFT_CATALOG[driftType].affected_boundary,
        auto_fixable: DRIFT_CATALOG[driftType].auto_fixable,
        reason,
      },
    });
  } catch {
    /* fail-soft */
  }
}

/**
 * Boundary única de detecção: roda todos os detectores e, se houver drift,
 * emite `drift_detected` por finding. Nunca lança.
 */
export async function runDriftAudit(
  ctx: DriftAuditContext,
  input: DetectAllInput,
): Promise<DriftReport> {
  try {
    const report = detectAllDrifts(input);
    if (report.hasDrift) await logDriftDetected(ctx, report);
    return report;
  } catch (e: any) {
    await logDriftDetectionFailed(ctx, e?.code ?? 'detector_threw');
    return {
      hasDrift: false,
      drifts: [],
      severity: 'info',
      canonicalOwner: 'none',
      reconciliationHints: [],
    };
  }
}
