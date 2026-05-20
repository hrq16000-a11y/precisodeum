/**
 * Fase 1.9.3 — Aggregation (READ-ONLY, pure).
 */
import type {
  EntropyLevel,
  EquilibriumRisk,
  EquilibriumSeverity,
  PropagationEnergy,
  RuntimeEquilibriumAggregate,
  RuntimeEquilibriumEnvelope,
  TopologyTension,
} from './equilibriumTypes';

const SEV: Record<EquilibriumSeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };
const ENT: Record<EntropyLevel, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const PRO: Record<PropagationEnergy, number> = { STATIC: 0, CONTAINED: 1, ACTIVE: 2, ESCALATING: 3, UNBOUNDED: 4 };
const TEN: Record<TopologyTension, number> = { RELAXED: 0, BALANCED: 1, STRESSED: 2, FRACTURED: 3, COLLAPSING: 4 };

function worst<T extends string>(vs: readonly T[], r: Record<T, number>, zero: T): T {
  let m = zero;
  for (const v of vs) if (r[v] > r[m]) m = v;
  return m;
}

export function rankEquilibriumRisk(envs: readonly RuntimeEquilibriumEnvelope[]): EquilibriumSeverity {
  const all: EquilibriumSeverity[] = [];
  for (const e of envs) for (const r of e.risks) all.push(r.severity);
  return worst(all, SEV, 'info');
}

export function summarizeEquilibriumHealth(envs: readonly RuntimeEquilibriumEnvelope[]): { readonly stable: boolean; readonly avgScore: number } {
  if (envs.length === 0) return Object.freeze({ stable: true, avgScore: 1 });
  const sum = envs.reduce((a, e) => a + e.score, 0);
  return Object.freeze({ stable: envs.every((e) => e.stable), avgScore: sum / envs.length });
}

export function calculateGlobalEquilibrium(envs: readonly RuntimeEquilibriumEnvelope[]): number {
  if (envs.length === 0) return 1;
  return envs.reduce((a, e) => a + e.certification.confidence, 0) / envs.length;
}

export function aggregateEquilibriumMechanics(envs: readonly RuntimeEquilibriumEnvelope[]): RuntimeEquilibriumAggregate {
  const risks: EquilibriumRisk[] = [];
  for (const e of envs) for (const r of e.risks) risks.push(r);
  const h = summarizeEquilibriumHealth(envs);
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score: h.avgScore,
    confidence: calculateGlobalEquilibrium(envs),
    worstSeverity: rankEquilibriumRisk(envs),
    worstEntropy: worst(envs.map((e) => e.entropy.level), ENT, 'NONE'),
    worstPropagation: worst(envs.map((e) => e.propagation.energy), PRO, 'STATIC'),
    worstTension: worst(envs.map((e) => e.topology.tension), TEN, 'RELAXED'),
    stable: h.stable,
    risks: Object.freeze(risks),
  });
}
