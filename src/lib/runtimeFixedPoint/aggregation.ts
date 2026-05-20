/**
 * Fase 1.9.1 — Aggregation (READ-ONLY, deterministic).
 */

import type {
  FixedPointAggregation,
  FixedPointEnvelope,
  FixedPointRisk,
  FixedPointViolationCode,
} from './fixedPointTypes';

const SEVERITY_RANK: Record<string, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

export function aggregateFixedPointRuntime(
  envelopes: readonly FixedPointEnvelope[],
): FixedPointAggregation {
  const score = calculateFixedPointConfidence(envelopes) * 100;
  const confidence = calculateFixedPointConfidence(envelopes);
  const complexity = calculateFixedPointComplexity(envelopes);
  const risks = rankFixedPointRisks(envelopes);
  const stable =
    envelopes.length > 0 &&
    envelopes.every(
      (e) =>
        e.certification.rank === 'FULL' || e.certification.rank === 'PARTIAL',
    ) &&
    risks.every((r) => r.severity !== 'critical');
  return Object.freeze({
    envelopes: Object.freeze([...envelopes]),
    score,
    confidence,
    complexity,
    stable,
    risks,
  });
}

export function summarizeFixedPointHealth(
  envelopes: readonly FixedPointEnvelope[],
): { stable: number; total: number } {
  return Object.freeze({
    stable: envelopes.filter((e) => e.health.stable).length,
    total: envelopes.length,
  });
}

export function rankFixedPointRisks(
  envelopes: readonly FixedPointEnvelope[],
): readonly FixedPointRisk[] {
  const all: FixedPointRisk[] = [];
  for (const e of envelopes) all.push(...e.health.risks);
  return Object.freeze(
    [...all].sort(
      (a, b) =>
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
    ),
  );
}

export function rankFixedPointViolations(
  envelopes: readonly FixedPointEnvelope[],
): readonly FixedPointViolationCode[] {
  return Object.freeze(rankFixedPointRisks(envelopes).map((r) => r.code));
}

export function calculateFixedPointConfidence(
  envelopes: readonly FixedPointEnvelope[],
): number {
  if (envelopes.length === 0) return 0;
  const sum = envelopes.reduce(
    (acc, e) => acc + e.certification.confidence,
    0,
  );
  return sum / envelopes.length;
}

export function calculateFixedPointComplexity(
  envelopes: readonly FixedPointEnvelope[],
): number {
  return envelopes.reduce(
    (acc, e) =>
      acc + e.resolution.fixedPoints.reduce((a, f) => a + f.iterations, 0),
    0,
  );
}
