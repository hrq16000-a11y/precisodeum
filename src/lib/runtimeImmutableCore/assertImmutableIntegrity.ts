/**
 * Fase 1.8.8 — Aggregate immutable integrity (READ-ONLY).
 */

import {
  assertImmutableCoverage,
  assertImmutableReadOnlyInvariant,
  assertImmutableSealIntegrity,
  assertNoCrossLayerEscape,
  assertNoRuntimeUnlock,
  type GuardViolation,
} from './immutableGuards';
import type { ImmutableEnvelope } from './immutableTypes';

export function assertAllImmutableIntegrity(
  envelopes: readonly ImmutableEnvelope[],
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  out.push(...assertImmutableCoverage(envelopes));
  for (const env of envelopes) {
    out.push(...assertImmutableReadOnlyInvariant(env));
    out.push(...assertNoRuntimeUnlock(env.seal));
    out.push(...assertNoCrossLayerEscape(env.seal));
    out.push(...assertImmutableSealIntegrity(env.seal));
  }
  return out;
}
