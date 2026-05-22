/**
 * Phase 1.9.48 — Fail-closed policy.
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SponsorSafetyViolation } from './sponsorInvariantViolationRegistry';
import { escalationFor } from './sponsorEscalationConstraints';

export interface FailClosedDecision {
  readonly allow: false;
  readonly reason: 'safety_violation' | 'no_violations_but_default_block_when_unproven';
  readonly violationCount: number;
  readonly highestSeverity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  readonly action: 'BLOCK' | 'BLOCK_AND_ALERT' | 'BLOCK_AND_KILL_SWITCH' | 'BLOCK_DEFAULT';
  readonly decisionSignature: string;
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

export function enforceFailClosedPolicy(
  violations: ReadonlyArray<SponsorSafetyViolation>,
): FailClosedDecision {
  if (violations.length === 0) {
    const payload = {
      allow: false as const,
      reason: 'no_violations_but_default_block_when_unproven' as const,
      violationCount: 0,
      highestSeverity: 'none' as const,
      action: 'BLOCK_DEFAULT' as const,
    };
    return Object.freeze({ ...payload, decisionSignature: signObject(payload) });
  }
  const highest = violations.reduce(
    (acc, v) => (SEVERITY_RANK[v.severity] > SEVERITY_RANK[acc] ? v.severity : acc),
    'low' as FailClosedDecision['highestSeverity'],
  );
  const action = escalationFor(highest as 'critical' | 'high' | 'medium' | 'low').action;
  const payload = {
    allow: false as const,
    reason: 'safety_violation' as const,
    violationCount: violations.length,
    highestSeverity: highest,
    action,
  };
  return Object.freeze({ ...payload, decisionSignature: signObject(payload) });
}
