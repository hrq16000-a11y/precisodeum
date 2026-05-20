import type { CategoryRisk, CategorySeverity, CategoryStabilityClass, CoherenceClass, FunctorClass, MorphismsPropagation, RuntimeCategoryAggregate, RuntimeCategoryEnvelope, TransformationClass } from './categoryTypes';

const SEV: Record<CategorySeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };
const CAT: Record<CategoryStabilityClass, number> = { IDENTITY: 0, STABLE: 1, TRANSFORMING: 2, FRACTURED: 3, COLLAPSED: 4 };
const FUN: Record<FunctorClass, number> = { PRESERVING: 0, WEAKLY_PRESERVING: 1, DISTORTING: 2, RECURSIVE: 3, DEGENERATE: 4 };
const TRA: Record<TransformationClass, number> = { NATURAL: 0, WEAK: 1, PARTIAL: 2, BROKEN: 3, NON_NATURAL: 4 };
const MOR: Record<MorphismsPropagation, number> = { ISOLATED: 0, CONTAINED: 1, DISTRIBUTED: 2, ESCALATING: 3, INFINITE: 4 };
const COH: Record<CoherenceClass, number> = { COHERENT: 0, WEAKLY_COHERENT: 1, INCONSISTENT: 2, FRACTURED: 3, COLLAPSING: 4 };

function worst<T extends string>(vs: readonly T[], r: Record<T, number>, zero: T): T { let m = zero; for (const v of vs) if (r[v] > r[m]) m = v; return m; }

export function rankCategoryRisk(envs: readonly RuntimeCategoryEnvelope[]): CategorySeverity {
  const all: CategorySeverity[] = [];
  for (const e of envs) for (const r of e.risks) all.push(r.severity);
  return worst(all, SEV, 'info');
}

export function summarizeCategoryHealth(envs: readonly RuntimeCategoryEnvelope[]): { readonly stable: boolean; readonly avgScore: number } {
  if (envs.length === 0) return Object.freeze({ stable: true, avgScore: 1 });
  const sum = envs.reduce((a, e) => a + e.score, 0);
  return Object.freeze({ stable: envs.every((e) => e.stable), avgScore: sum / envs.length });
}

export function calculateGlobalCategoryEquilibrium(envs: readonly RuntimeCategoryEnvelope[]): number {
  if (envs.length === 0) return 1;
  return envs.reduce((a, e) => a + e.certification.confidence, 0) / envs.length;
}

export function aggregateCategoryMechanics(envs: readonly RuntimeCategoryEnvelope[]): RuntimeCategoryAggregate {
  const risks: CategoryRisk[] = [];
  for (const e of envs) for (const r of e.risks) risks.push(r);
  const h = summarizeCategoryHealth(envs);
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score: h.avgScore,
    confidence: calculateGlobalCategoryEquilibrium(envs),
    worstSeverity: rankCategoryRisk(envs),
    worstCategory: worst(envs.map((e) => e.category.classification), CAT, 'IDENTITY'),
    worstFunctor: worst(envs.map((e) => e.functor.class), FUN, 'PRESERVING'),
    worstTransformation: worst(envs.map((e) => e.transformation.class), TRA, 'NATURAL'),
    worstMorphisms: worst(envs.map((e) => e.morphisms.propagation), MOR, 'ISOLATED'),
    worstCoherence: worst(envs.map((e) => e.coherence.class), COH, 'COHERENT'),
    stable: h.stable,
    risks: Object.freeze(risks),
  });
}
