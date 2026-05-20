// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Aggregation
// Canonical, deterministic, read-only aggregation over meta transformations.

import type {
  MetaCertification,
  MetaClass,
  MetaCompositionClass,
  MetaDeterminismClass,
  MetaFixedPointClass,
  MetaFunctorialityClass,
  MetaIdentityClass,
  MetaLiftingClass,
  MetaNaturalityClass,
  MetaRisk,
  MetaSeverity,
  MetaTopologyClass,
  RuntimeMetaAggregate,
  RuntimeMetaEnvelope,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import { composeMetaTransformations } from './metaComposition';
import { certifyMetaIdentity } from './metaIdentity';
import { normalizeMetaTransformation, isMetaNormalizationIdempotent } from './metaNormalization';
import { computeMetaDeterminismSignature, isMetaTransformationDeterministic } from './metaDeterminism';
import { metaTransformationsEquivalent } from './metaEquivalence';
import { buildMetaTopology } from './metaTopology';
import { buildMetaStability } from './metaStability';
import { buildMetaCertification } from './metaCertification';

const STAGE_0 = 'STAGE_0_READ_ONLY' as const;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
}

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'agg_' + h.toString(16).padStart(8, '0');
}

const SEVERITY_RANK: Record<MetaSeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };

function avgComponent(t: RuntimeMetaTransformation, key: 'naturality' | 'functoriality' | 'lift' | 'fixedPoint' | 'determinism' | 'stability' | 'identity'): number {
  if (t.components.length === 0) return 0;
  let s = 0;
  for (const c of t.components) s += c[key];
  return Math.round((s / t.components.length) * 1e6) / 1e6;
}

function classifyScalar(score: number, broken: boolean): 'OK' | 'WEAK' | 'PARTIAL' | 'BROKEN' {
  if (broken) return 'BROKEN';
  if (score >= 0.85) return 'OK';
  if (score >= 0.6) return 'WEAK';
  return 'PARTIAL';
}

function buildEnvelope(t: RuntimeMetaTransformation): RuntimeMetaEnvelope {
  const normalized = normalizeMetaTransformation(t);
  const composition = composeMetaTransformations([normalized]);
  const identity = certifyMetaIdentity(normalized);
  const detReport = isMetaTransformationDeterministic(normalized);
  const eqReport = metaTransformationsEquivalent(normalized, normalized, 'STRUCTURAL');
  const topology = buildMetaTopology(normalized);
  const stability = buildMetaStability(normalized);
  const certification: MetaCertification = buildMetaCertification(normalized);

  const naturalityScore = avgComponent(normalized, 'naturality');
  const functorialityScore = avgComponent(normalized, 'functoriality');
  const liftScore = avgComponent(normalized, 'lift');
  const fixedScore = avgComponent(normalized, 'fixedPoint');
  const determinismScore = avgComponent(normalized, 'determinism');

  const naturalityClass = classifyScalar(naturalityScore, false) as MetaNaturalityClass extends infer R ? R : never;
  const functorialityClass = classifyScalar(functorialityScore, false);
  const liftingClass = classifyScalar(liftScore, false);

  const envelope: RuntimeMetaEnvelope = {
    id: normalized.signature,
    transformation: normalized,
    composition,
    identity,
    normalization: deepFreeze({
      class: isMetaNormalizationIdempotent(normalized) ? 'IDEMPOTENT' : 'UNSTABLE',
      stability: stability.score,
      idempotent: isMetaNormalizationIdempotent(normalized),
      divergent: false,
    }),
    determinism: deepFreeze({
      class: detReport.verdict === 'STRICT' || detReport.verdict === 'STABLE' ? 'DETERMINISTIC' : detReport.verdict === 'EVENTUAL' ? 'WEAK' : 'NONDETERMINISTIC',
      score: determinismScore,
      degraded: detReport.verdict !== 'STRICT' && detReport.verdict !== 'STABLE',
    }),
    equivalence: deepFreeze({
      class: eqReport.equivalent ? 'EQUIVALENT' : 'REGRESSED',
      strength: eqReport.equivalent ? 1 : 0,
      regressed: !eqReport.equivalent,
      fractured: false,
    }),
    reduction: deepFreeze({
      class: 'IDEMPOTENT',
      idempotent: true,
      score: stability.score,
    }),
    topology,
    stability,
    naturality: deepFreeze({
      class: (naturalityClass === 'OK' ? 'NATURAL' : naturalityClass) as MetaNaturalityClass,
      score: naturalityScore,
      violations: 0,
      broken: false,
    }),
    functoriality: deepFreeze({
      class: (functorialityClass === 'OK' ? 'FUNCTORIAL' : functorialityClass === 'BROKEN' ? 'FAILED' : functorialityClass) as MetaFunctorialityClass,
      score: functorialityScore,
      failed: false,
    }),
    lifting: deepFreeze({
      class: (liftingClass === 'OK' ? 'LIFTED' : liftingClass === 'BROKEN' ? 'UNLIFTABLE' : liftingClass) as MetaLiftingClass,
      score: liftScore,
      unliftable: false,
    }),
    fixedPoint: deepFreeze({
      class: (fixedScore >= 0.85 ? 'FIXED' : fixedScore >= 0.6 ? 'CONVERGENT' : fixedScore >= 0.3 ? 'OSCILLATING' : 'DIVERGENT') as MetaFixedPointClass,
      score: fixedScore,
      converged: fixedScore >= 0.6,
      divergent: fixedScore < 0.3,
    }),
    certification,
    risks: Object.freeze([] as readonly MetaRisk[]),
    score: normalized.score,
    stable: !stability.unstable && !stability.collapsed && !topology.unstable && !topology.collapsed,
  };
  return deepFreeze(envelope);
}

export interface RuntimeMetaAggregateEnvelope {
  readonly aggregate: RuntimeMetaAggregate;
  readonly signature: string;
  readonly ranking: MetaAggregateRanking;
  readonly summary: MetaAggregateSummary;
}

export interface MetaAggregateRanking {
  readonly order: readonly string[];
  readonly byScore: readonly { readonly id: string; readonly score: number }[];
}

export interface MetaAggregateSummary {
  readonly count: number;
  readonly avgScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly stableCount: number;
  readonly worstSeverity: MetaSeverity;
}

function worstSeverity(risks: readonly MetaRisk[]): MetaSeverity {
  let worst: MetaSeverity = 'info';
  for (const r of risks) if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[worst]) worst = r.severity;
  return worst;
}

function reduceWorst<T extends string>(values: readonly T[], ordering: readonly T[], fallback: T): T {
  let worstIdx = -1;
  for (const v of values) {
    const i = ordering.indexOf(v);
    if (i > worstIdx) worstIdx = i;
  }
  return worstIdx < 0 ? fallback : ordering[worstIdx];
}

const META_CLASS_ORDER: readonly MetaClass[] = ['META', 'WEAKLY_META', 'PARTIAL', 'BROKEN', 'DEGENERATE'];
const COMP_ORDER: readonly MetaCompositionClass[] = ['ASSOCIATIVE', 'WEAK', 'PARTIAL', 'NON_ASSOCIATIVE', 'BROKEN'];
const ID_ORDER: readonly MetaIdentityClass[] = ['PRESERVED', 'WEAK', 'BROKEN'];
const DET_ORDER: readonly MetaDeterminismClass[] = ['DETERMINISTIC', 'WEAK', 'NONDETERMINISTIC'];
const TOPO_ORDER: readonly MetaTopologyClass[] = ['STABLE', 'WEAK', 'UNSTABLE', 'COLLAPSED'];
const NAT_ORDER: readonly MetaNaturalityClass[] = ['NATURAL', 'WEAK', 'PARTIAL', 'BROKEN'];
const FUNC_ORDER: readonly MetaFunctorialityClass[] = ['FUNCTORIAL', 'WEAK', 'PARTIAL', 'FAILED'];
const LIFT_ORDER: readonly MetaLiftingClass[] = ['LIFTED', 'WEAK', 'PARTIAL', 'UNLIFTABLE'];
const FP_ORDER: readonly MetaFixedPointClass[] = ['FIXED', 'CONVERGENT', 'OSCILLATING', 'DIVERGENT'];

export function aggregateMetaTransformations(parts: readonly RuntimeMetaTransformation[]): RuntimeMetaAggregate {
  const envelopes = parts.map(buildEnvelope);

  const sorted = envelopes.slice().sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const sa = SEVERITY_RANK[worstSeverity(a.risks)];
    const sb = SEVERITY_RANK[worstSeverity(b.risks)];
    if (sa !== sb) return sa - sb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const frozen = Object.freeze(sorted);

  let scoreSum = 0;
  let confSum = 0;
  let allStable = true;
  const risks: MetaRisk[] = [];
  for (const e of frozen) {
    scoreSum += e.score;
    confSum += e.certification.confidence;
    if (!e.stable) allStable = false;
    risks.push(...e.risks);
  }

  const aggregate: RuntimeMetaAggregate = {
    envelopes: frozen,
    score: frozen.length === 0 ? 0 : Math.round((scoreSum / frozen.length) * 1e6) / 1e6,
    confidence: frozen.length === 0 ? 0 : Math.round((confSum / frozen.length) * 1e6) / 1e6,
    worstSeverity: worstSeverity(risks),
    worstMeta: reduceWorst<MetaClass>(frozen.map((e) => e.transformation.class), META_CLASS_ORDER, 'META'),
    worstComposition: reduceWorst<MetaCompositionClass>(frozen.map((e) => e.composition.class), COMP_ORDER, 'ASSOCIATIVE'),
    worstIdentity: reduceWorst<MetaIdentityClass>(frozen.map((e) => e.identity.class), ID_ORDER, 'PRESERVED'),
    worstDeterminism: reduceWorst<MetaDeterminismClass>(frozen.map((e) => e.determinism.class), DET_ORDER, 'DETERMINISTIC'),
    worstTopology: reduceWorst<MetaTopologyClass>(frozen.map((e) => e.topology.class), TOPO_ORDER, 'STABLE'),
    worstNaturality: reduceWorst<MetaNaturalityClass>(frozen.map((e) => e.naturality.class), NAT_ORDER, 'NATURAL'),
    worstFunctoriality: reduceWorst<MetaFunctorialityClass>(frozen.map((e) => e.functoriality.class), FUNC_ORDER, 'FUNCTORIAL'),
    worstLifting: reduceWorst<MetaLiftingClass>(frozen.map((e) => e.lifting.class), LIFT_ORDER, 'LIFTED'),
    worstFixedPoint: reduceWorst<MetaFixedPointClass>(frozen.map((e) => e.fixedPoint.class), FP_ORDER, 'FIXED'),
    stable: allStable,
    risks: Object.freeze(risks),
  };
  return deepFreeze(aggregate);
}

export function rankMetaTransformations(parts: readonly RuntimeMetaTransformation[]): MetaAggregateRanking {
  const agg = aggregateMetaTransformations(parts);
  const byScore = agg.envelopes.map((e) => deepFreeze({ id: e.id, score: e.score }));
  return deepFreeze({
    order: Object.freeze(agg.envelopes.map((e) => e.id)),
    byScore: Object.freeze(byScore),
  });
}

export function summarizeMetaAggregate(agg: RuntimeMetaAggregate): MetaAggregateSummary {
  if (agg.envelopes.length === 0) {
    return deepFreeze({ count: 0, avgScore: 0, minScore: 0, maxScore: 0, stableCount: 0, worstSeverity: 'info' as MetaSeverity });
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let stable = 0;
  for (const e of agg.envelopes) {
    if (e.score < min) min = e.score;
    if (e.score > max) max = e.score;
    sum += e.score;
    if (e.stable) stable++;
  }
  return deepFreeze({
    count: agg.envelopes.length,
    avgScore: Math.round((sum / agg.envelopes.length) * 1e6) / 1e6,
    minScore: Math.round(min * 1e6) / 1e6,
    maxScore: Math.round(max * 1e6) / 1e6,
    stableCount: stable,
    worstSeverity: agg.worstSeverity,
  });
}

export function computeMetaAggregateSignature(agg: RuntimeMetaAggregate): string {
  const minimal = {
    score: agg.score,
    confidence: agg.confidence,
    stable: agg.stable,
    worstSeverity: agg.worstSeverity,
    worstMeta: agg.worstMeta,
    ids: agg.envelopes.map((e) => e.id),
    sigs: agg.envelopes.map((e) => computeMetaDeterminismSignature(e.transformation)),
  };
  return fnv1a(stableStringify(minimal));
}

export function detectMetaAggregateRegression(prev: RuntimeMetaAggregate, next: RuntimeMetaAggregate): boolean {
  if (next.score + 1e-6 < prev.score) return true;
  if (prev.stable && !next.stable) return true;
  if (SEVERITY_RANK[next.worstSeverity] > SEVERITY_RANK[prev.worstSeverity]) return true;
  return false;
}

export function isMetaAggregateDeterministic(parts: readonly RuntimeMetaTransformation[]): boolean {
  const a = aggregateMetaTransformations(parts);
  const b = aggregateMetaTransformations(parts.slice());
  return computeMetaAggregateSignature(a) === computeMetaAggregateSignature(b);
}

export function certifyMetaAggregate(agg: RuntimeMetaAggregate): MetaCertification {
  const reasons: string[] = [];
  if (!agg.stable) reasons.push('aggregate unstable');
  if (agg.worstSeverity === 'critical') reasons.push('critical risk present');
  const safe = reasons.length === 0;
  const rank: MetaCertification['rank'] = safe ? 'OK' : agg.worstSeverity === 'critical' ? 'BLOCKED' : 'WARN';
  return deepFreeze({
    safe,
    confidence: agg.confidence,
    rank,
    reasons: Object.freeze(reasons.slice().sort()),
  });
}

export function freezeMetaAggregate(agg: RuntimeMetaAggregate): RuntimeMetaAggregate {
  return deepFreeze(agg);
}

export function buildMetaAggregateEnvelope(parts: readonly RuntimeMetaTransformation[]): RuntimeMetaAggregateEnvelope {
  const aggregate = aggregateMetaTransformations(parts);
  const ranking = rankMetaTransformations(parts);
  const summary = summarizeMetaAggregate(aggregate);
  const signature = computeMetaAggregateSignature(aggregate);
  return deepFreeze({ aggregate, signature, ranking, summary });
}

export const __meta_aggregation_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  buildEnvelope,
  worstSeverity,
  reduceWorst,
});
