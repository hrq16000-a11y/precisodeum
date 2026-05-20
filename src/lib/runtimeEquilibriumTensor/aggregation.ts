import type { CurvatureClass, InstabilityDensity, RuntimeTensorAggregate, RuntimeTensorEnvelope, SingularityClass, TensorRisk, TensorSeverity, TopologyDeformation } from './tensorTypes';
const SEV: Record<TensorSeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };
const CUR: Record<CurvatureClass, number> = { FLAT: 0, CONTAINED: 1, AMPLIFIED: 2, RECURSIVE: 3, UNBOUNDED: 4 };
const DEN: Record<InstabilityDensity, number> = { VOID: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const DEF: Record<TopologyDeformation, number> = { NONE: 0, LOCAL: 1, DISTRIBUTED: 2, FRACTURED: 3, COLLAPSING: 4 };
const SIN: Record<SingularityClass, number> = { NONE: 0, LOCALIZED: 1, PROPAGATING: 2, RECURSIVE: 3, TERMINAL: 4 };
function worst<T extends string>(vs: readonly T[], r: Record<T, number>, zero: T): T { let m = zero; for (const v of vs) if (r[v] > r[m]) m = v; return m; }
export function rankTensorRisk(envs: readonly RuntimeTensorEnvelope[]): TensorSeverity { const all: TensorSeverity[] = []; for (const e of envs) for (const r of e.risks) all.push(r.severity); return worst(all, SEV, 'info'); }
export function summarizeTensorHealth(envs: readonly RuntimeTensorEnvelope[]): { readonly stable: boolean; readonly avgScore: number } { if (envs.length === 0) return Object.freeze({ stable: true, avgScore: 1 }); const sum = envs.reduce((a, e) => a + e.score, 0); return Object.freeze({ stable: envs.every((e) => e.stable), avgScore: sum / envs.length }); }
export function calculateGlobalTensorEquilibrium(envs: readonly RuntimeTensorEnvelope[]): number { if (envs.length === 0) return 1; return envs.reduce((a, e) => a + e.certification.confidence, 0) / envs.length; }
export function aggregateTensorMechanics(envs: readonly RuntimeTensorEnvelope[]): RuntimeTensorAggregate {
  const risks: TensorRisk[] = []; for (const e of envs) for (const r of e.risks) risks.push(r);
  const h = summarizeTensorHealth(envs);
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score: h.avgScore,
    confidence: calculateGlobalTensorEquilibrium(envs),
    worstSeverity: rankTensorRisk(envs),
    worstCurvature: worst(envs.map((e) => e.curvature.class), CUR, 'FLAT'),
    worstDensity: worst(envs.map((e) => e.density.level), DEN, 'VOID'),
    worstDeformation: worst(envs.map((e) => e.topology.deformation), DEF, 'NONE'),
    worstSingularity: worst(envs.map((e) => e.singularity.class), SIN, 'NONE'),
    stable: h.stable,
    risks: Object.freeze(risks),
  });
}
