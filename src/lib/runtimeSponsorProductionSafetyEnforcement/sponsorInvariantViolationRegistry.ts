/**
 * Phase 1.9.48 — Invariant violation registry (read-only).
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';

export type SponsorSafetySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SponsorSafetyInvariant {
  readonly id: string;
  readonly description: string;
  readonly severity: SponsorSafetySeverity;
  readonly vector:
    | 'activation' | 'rollout' | 'execution' | 'exposure'
    | 'monetization' | 'persistence' | 'networking' | 'scheduling';
}

export const SPONSOR_SAFETY_INVARIANTS: ReadonlyArray<SponsorSafetyInvariant> = Object.freeze([
  Object.freeze({ id: 'SAFE-NO-REAL-NETWORKING', description: 'No real network IO', severity: 'critical' as const, vector: 'networking' as const }),
  Object.freeze({ id: 'SAFE-NO-REAL-PERSISTENCE', description: 'No mutable persistence', severity: 'critical' as const, vector: 'persistence' as const }),
  Object.freeze({ id: 'SAFE-NO-REAL-BILLING', description: 'No real billing', severity: 'critical' as const, vector: 'monetization' as const }),
  Object.freeze({ id: 'SAFE-NO-REAL-SCHEDULING', description: 'No real scheduling', severity: 'critical' as const, vector: 'scheduling' as const }),
  Object.freeze({ id: 'SAFE-NO-REAL-MONETIZATION', description: 'No real monetization', severity: 'critical' as const, vector: 'monetization' as const }),
  Object.freeze({ id: 'SAFE-NO-UPSTREAM-MUTATION', description: 'Upstream layers immutable', severity: 'critical' as const, vector: 'execution' as const }),
  Object.freeze({ id: 'SAFE-DETERMINISTIC-EXECUTION', description: 'Deterministic execution only', severity: 'high' as const, vector: 'execution' as const }),
  Object.freeze({ id: 'SAFE-EXPOSURE-CAPPED', description: 'Exposure caps respected', severity: 'high' as const, vector: 'exposure' as const }),
  Object.freeze({ id: 'SAFE-ROLLOUT-FAIL-CLOSED', description: 'Rollout violations block', severity: 'critical' as const, vector: 'rollout' as const }),
  Object.freeze({ id: 'SAFE-ACTIVATION-FAIL-CLOSED', description: 'Activation violations block', severity: 'critical' as const, vector: 'activation' as const }),
]);

export interface SponsorSafetyViolation {
  readonly invariantId: string;
  readonly vector: SponsorSafetyInvariant['vector'];
  readonly severity: SponsorSafetySeverity;
  readonly detail: string;
  readonly violationSignature: string;
}

export function recordViolation(
  invariantId: string,
  detail: string,
): SponsorSafetyViolation {
  const inv = SPONSOR_SAFETY_INVARIANTS.find((i) => i.id === invariantId);
  if (!inv) {
    return Object.freeze({
      invariantId,
      vector: 'execution' as const,
      severity: 'critical' as const,
      detail: `unknown invariant: ${detail}`,
      violationSignature: signObject({ unknown: invariantId, detail }),
    });
  }
  return Object.freeze({
    invariantId: inv.id,
    vector: inv.vector,
    severity: inv.severity,
    detail,
    violationSignature: signObject({ id: inv.id, detail, sev: inv.severity }),
  });
}
