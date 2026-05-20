/**
 * Fase 1.9.2 — Final aggregate assert (READ-ONLY).
 */

import {
  assertConvergenceCertificationIntegrity,
  assertConvergenceReadonly,
  assertMonotonicityGuard,
  assertNoInfiniteResolution,
  assertNoRecursiveCollapse,
  assertNoTopologyFragmentation,
  assertNoUnsafeConvergence,
  assertSaturationGuard,
  assertStabilityGuard,
  assertTerminalGuard,
  type ConvergenceGuardViolation,
} from './convergenceGuards';
import type { RuntimeConvergenceEnvelope } from './convergenceTypes';

export function assertAllConvergenceIntegrity(
  envelopes: readonly RuntimeConvergenceEnvelope[],
): readonly ConvergenceGuardViolation[] {
  const out: ConvergenceGuardViolation[] = [];
  for (const env of envelopes) {
    out.push(...assertConvergenceReadonly(env.space.nodes));
    out.push(...assertNoUnsafeConvergence(env));
    out.push(...assertNoRecursiveCollapse(env.fixedPoints));
    out.push(...assertNoTopologyFragmentation(env.topology, env.divergence));
    out.push(...assertNoInfiniteResolution(env.terminal));
    out.push(...assertConvergenceCertificationIntegrity(env.certification));
    out.push(...assertSaturationGuard(env.saturation));
    out.push(...assertMonotonicityGuard(env.monotonic));
    out.push(...assertTerminalGuard(env.terminal));
    out.push(...assertStabilityGuard(env.stability));
  }
  return Object.freeze(out);
}
