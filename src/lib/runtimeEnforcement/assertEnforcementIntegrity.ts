/**
 * Fase 1.8.7 — Aggregate enforcement integrity (READ-ONLY).
 */

import {
  assertEnforcementCoverage,
  assertNoBoundaryEscape,
  assertNoImplicitMutation,
  assertNoUnsafeRuntimeActivation,
  assertRuntimeLockdownInvariant,
  type GuardViolation,
} from './enforcementGuards';
import type { EnforcementEnvelope } from './enforcementTypes';

export function assertAllEnforcementIntegrity(
  envelopes: readonly EnforcementEnvelope[],
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  out.push(...assertEnforcementCoverage(envelopes));
  for (const env of envelopes) {
    out.push(...assertNoBoundaryEscape(env.enforcement));
    out.push(...assertNoImplicitMutation(env.enforcement));
    out.push(...assertNoUnsafeRuntimeActivation(env));
    out.push(...assertRuntimeLockdownInvariant(env.enforcement));
  }
  return out;
}
