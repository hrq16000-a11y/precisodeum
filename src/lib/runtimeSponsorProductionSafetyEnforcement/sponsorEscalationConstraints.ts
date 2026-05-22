/**
 * Phase 1.9.48 — Escalation constraints (read-only).
 */
import type { SponsorSafetySeverity } from './sponsorInvariantViolationRegistry';

export interface SponsorEscalationConstraint {
  readonly severity: SponsorSafetySeverity;
  readonly action: 'BLOCK' | 'BLOCK_AND_ALERT' | 'BLOCK_AND_KILL_SWITCH';
  readonly autoUnlock: false;
}

export const SPONSOR_ESCALATION_CONSTRAINTS: ReadonlyArray<SponsorEscalationConstraint> = Object.freeze([
  Object.freeze({ severity: 'critical' as const, action: 'BLOCK_AND_KILL_SWITCH' as const, autoUnlock: false as const }),
  Object.freeze({ severity: 'high' as const, action: 'BLOCK_AND_ALERT' as const, autoUnlock: false as const }),
  Object.freeze({ severity: 'medium' as const, action: 'BLOCK' as const, autoUnlock: false as const }),
  Object.freeze({ severity: 'low' as const, action: 'BLOCK' as const, autoUnlock: false as const }),
]);

export function escalationFor(severity: SponsorSafetySeverity): SponsorEscalationConstraint {
  return SPONSOR_ESCALATION_CONSTRAINTS.find((c) => c.severity === severity)!;
}
