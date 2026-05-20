import type { ContinuityClass, ContinuumSingularity, DeformationContinuum, GeodesicPropagation, ManifoldRisk, ManifoldSeverity, RuntimeManifoldAggregate, RuntimeManifoldEnvelope } from './manifoldTypes';
const SEV: Record<ManifoldSeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };
const CON: Record<ContinuityClass, number> = { CONTINUOUS: 0, WEAKLY_CONTINUOUS: 1, DISCONTINUOUS: 2, FRACTURED: 3, COLLAPSED: 4 };
const GEO: Record<GeodesicPropagation, number> = { MINIMAL: 0, CONTAINED: 1, DISTRIBUTED: 2, ESCALATING: 3, INFINITE: 4 };
const DEF: Record<DeformationContinuum, number> = { NONE: 0, ELASTIC: 1, DISTRIBUTED: 2, FRACTURED: 3, IRREVERSIBLE: 4 };
const SIN: Record<ContinuumSingularity, number> = { NONE: 0, LOCAL: 1, DISTRIBUTED: 2, RECURSIVE: 3, TERMINAL: 4 };
function worst<T extends string>(vs: readonly T[], r: Record<T, number>, zero: T): T { let m = zero; for (const v of vs) if (r[v] > r[m]) m = v; return m; }
export function rankManifoldRisk(envs: readonly RuntimeManifoldEnvelope[]): ManifoldSeverity { const all: ManifoldSeverity[] = []; for (const e of envs) for (const r of e.risks) all.push(r.severity); return worst(all, SEV, 'info'); }
export function summarizeManifoldHealth(envs: readonly RuntimeManifoldEnvelope[]): { readonly stable: boolean; readonly avgScore: number } { if (envs.length === 0) return Object.freeze({ stable: true, avgScore: 1 }); const sum = envs.reduce((a, e) => a + e.score, 0); return Object.freeze({ stable: envs.every((e) => e.stable), avgScore: sum / envs.length }); }
export function calculateGlobalManifoldEquilibrium(envs: readonly RuntimeManifoldEnvelope[]): number { if (envs.length === 0) return 1; return envs.reduce((a, e) => a + e.certification.confidence, 0) / envs.length; }
export function aggregateManifoldMechanics(envs: readonly RuntimeManifoldEnvelope[]): RuntimeManifoldAggregate {
  const risks: ManifoldRisk[] = []; for (const e of envs) for (const r of e.risks) risks.push(r);
  const h = summarizeManifoldHealth(envs);
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score: h.avgScore,
    confidence: calculateGlobalManifoldEquilibrium(envs),
    worstSeverity: rankManifoldRisk(envs),
    worstContinuity: worst(envs.map((e) => e.continuity.class), CON, 'CONTINUOUS'),
    worstGeodesic: worst(envs.map((e) => e.geodesic.propagation), GEO, 'MINIMAL'),
    worstDeformation: worst(envs.map((e) => e.deformation.deformation), DEF, 'NONE'),
    worstSingularity: worst(envs.map((e) => e.singularity.class), SIN, 'NONE'),
    stable: h.stable,
    risks: Object.freeze(risks),
  });
}
