/**
 * Fase 1.9.1 — Aggregate assert (READ-ONLY).
 */

import { assertEnvelope, type GuardViolation } from './fixedPointGuards';
import type { FixedPointEnvelope } from './fixedPointTypes';

export function assertAllFixedPointIntegrity(
  envelopes: readonly FixedPointEnvelope[],
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  for (const env of envelopes) out.push(...assertEnvelope(env));
  return Object.freeze(out);
}
