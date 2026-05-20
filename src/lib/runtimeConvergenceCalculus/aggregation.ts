/**
 * Fase 1.9.2 — Aggregation (READ-ONLY).
 */

import type {
  ConvergenceRisk,
  ConvergenceSeverity,
  DivergenceSeverity,
  RuntimeConvergenceAggregate,
  RuntimeConvergenceEnvelope,
  SaturationLevel,
} from './convergenceTypes';

const SEV_RANK: Record<ConvergenceSeverity, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

const DIV_RANK: Record<DivergenceSeverity, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const SAT_RANK: Record<SaturationLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function worst<T extends string>(
  values: readonly T[],
  rank: Record<T, number>,
  zero: T,
): T {
  let max = zero;
  for (const v of values) if (rank[v] > rank[max]) max = v;
  return max;
}

export function rankConvergenceRisk(
  envs: readonly RuntimeConvergenceEnvelope[],
): ConvergenceSeverity {
  const all: ConvergenceSeverity[] = [];
  for (const e of envs) for (const r of e.risks) all.push(r.severity);
  return worst(all, SEV_RANK, 'info');
}

export function summarizeConvergenceHealth(
  envs: readonly RuntimeConvergenceEnvelope[],
): { readonly stable: boolean; readonly avgScore: number } {
  if (envs.length === 0) return Object.freeze({ stable: true, avgScore: 1 });
  const sum = envs.reduce((a, e) => a + e.score, 0);
  const avgScore = sum / envs.length;
  const stable = envs.every((e) => e.stable);
  return Object.freeze({ stable, avgScore });
}

export function calculateGlobalConvergence(
  envs: readonly RuntimeConvergenceEnvelope[],
): number {
  if (envs.length === 0) return 1;
  const sum = envs.reduce((a, e) => a + e.certification.confidence, 0);
  return sum / envs.length;
}

export function aggregateConvergenceCalculus(
  envs: readonly RuntimeConvergenceEnvelope[],
): RuntimeConvergenceAggregate {
  const risks: ConvergenceRisk[] = [];
  for (const e of envs) for (const r of e.risks) risks.push(r);
  const health = summarizeConvergenceHealth(envs);
  const confidence = calculateGlobalConvergence(envs);
  const worstSeverity = rankConvergenceRisk(envs);
  const worstDivergence = worst(
    envs.map((e) => e.divergence.severity),
    DIV_RANK,
    'NONE',
  );
  const worstSaturation = worst(
    envs.map((e) => e.saturation.level),
    SAT_RANK,
    'NONE',
  );
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score: health.avgScore,
    confidence,
    worstSeverity,
    worstDivergence,
    worstSaturation,
    stable: health.stable,
    risks: Object.freeze(risks),
  });
}
