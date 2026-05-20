// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Stability
// Pure, deterministic stability classification. Read-only.

import type {
  MetaStabilityClass,
  RuntimeMetaStability,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import { buildMetaTopology } from './metaTopology';
import { computeMetaDeterminismSignature } from './metaDeterminism';
import { normalizeMetaTransformation } from './metaNormalization';

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

function round6(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const x = n < 0 ? 0 : n > 1 ? 1 : n;
  return Math.round(x * 1e6) / 1e6;
}

export function computeMetaStabilityScore(t: RuntimeMetaTransformation): number {
  if (t.components.length === 0) return 0;
  let total = 0;
  for (const c of t.components) {
    const s =
      (c.stability + c.determinism + c.fixedPoint + c.identity + c.naturality) / 5;
    total += s;
  }
  const avg = total / t.components.length;
  const topo = buildMetaTopology(t);
  const blended = avg * 0.7 + topo.connectivity * 0.3;
  return round6(blended);
}

export function detectMetaCollapseRisk(t: RuntimeMetaTransformation): boolean {
  if (t.collapsed) return true;
  if (t.class === 'BROKEN' || t.class === 'DEGENERATE') return true;
  const topo = buildMetaTopology(t);
  if (topo.collapsed) return true;
  let weak = 0;
  for (const c of t.components) {
    const s =
      (c.stability + c.determinism + c.fixedPoint + c.identity + c.naturality) / 5;
    if (s < 0.35) weak++;
  }
  return weak > t.components.length / 2;
}

export function detectMetaPropagationInstability(t: RuntimeMetaTransformation): boolean {
  const topo = buildMetaTopology(t);
  if (topo.unstable) return true;
  let unstable = 0;
  for (const c of t.components) {
    if (c.stability < 0.4 || c.determinism < 0.4) unstable++;
  }
  return unstable > Math.max(1, Math.floor(t.components.length / 3));
}

export function isMetaStabilityDeterministic(t: RuntimeMetaTransformation): boolean {
  const a = computeMetaStabilityScore(t);
  const b = computeMetaStabilityScore(normalizeMetaTransformation(t));
  const sigA = computeMetaDeterminismSignature(t);
  const sigB = computeMetaDeterminismSignature(normalizeMetaTransformation(t));
  return Math.abs(a - b) < 1e-6 && sigA === sigB;
}

export function classifyMetaStability(t: RuntimeMetaTransformation): MetaStabilityClass {
  return buildMetaStability(t).class;
}

function classify(score: number, collapseRisk: boolean, propagationInstability: boolean, components: number): MetaStabilityClass {
  if (components === 0) return 'COLLAPSED';
  if (collapseRisk) return 'COLLAPSED';
  if (propagationInstability && score < 0.5) return 'UNSTABLE';
  if (propagationInstability) return 'WEAK';
  if (score >= 0.85) return 'STABLE';
  if (score >= 0.6) return 'WEAK';
  return 'UNSTABLE';
}

export function buildMetaStability(t: RuntimeMetaTransformation): RuntimeMetaStability {
  const score = computeMetaStabilityScore(t);
  const collapseRisk = detectMetaCollapseRisk(t);
  const propagation = detectMetaPropagationInstability(t);
  const klass = classify(score, collapseRisk, propagation, t.components.length);
  const envelope: RuntimeMetaStability = {
    class: klass,
    score,
    unstable: klass === 'UNSTABLE',
    collapsed: klass === 'COLLAPSED',
  };
  return deepFreeze(envelope);
}

export const __meta_stability_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
