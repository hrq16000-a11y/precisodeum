// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Explainers
// Pure, deterministic explanation strings. No timestamps, locale, randomness, or IO.

import type {
  MetaCertification,
  RuntimeMetaStability,
  RuntimeMetaTopology,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import type { MetaDeterminismReport } from './metaDeterminism';
import type { MetaEquivalenceReport } from './metaEquivalence';

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

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0.000000';
  const x = n < 0 ? 0 : n > 1 ? 1 : n;
  return x.toFixed(6);
}

export interface MetaExplanation {
  readonly subject: string;
  readonly summary: string;
  readonly bullets: readonly string[];
}

function make(subject: string, summary: string, bullets: readonly string[]): MetaExplanation {
  const sorted = [...bullets].sort();
  return deepFreeze({ subject, summary, bullets: Object.freeze(sorted) });
}

export function explainMetaTransformation(t: RuntimeMetaTransformation): MetaExplanation {
  return make(
    'transformation',
    `class=${t.class} score=${fmt(t.score)} components=${t.components.length} collapsed=${t.collapsed}`,
    [
      `signature=${t.signature}`,
      `componentCount=${t.components.length}`,
      `class=${t.class}`,
      `score=${fmt(t.score)}`,
      `collapsed=${t.collapsed ? 'yes' : 'no'}`,
    ],
  );
}

export function explainMetaTopology(topo: RuntimeMetaTopology): MetaExplanation {
  return make(
    'topology',
    `class=${topo.class} connectivity=${fmt(topo.connectivity)} unstable=${topo.unstable} collapsed=${topo.collapsed}`,
    [
      `class=${topo.class}`,
      `connectivity=${fmt(topo.connectivity)}`,
      `unstable=${topo.unstable ? 'yes' : 'no'}`,
      `collapsed=${topo.collapsed ? 'yes' : 'no'}`,
    ],
  );
}

export function explainMetaStability(stab: RuntimeMetaStability): MetaExplanation {
  return make(
    'stability',
    `class=${stab.class} score=${fmt(stab.score)} unstable=${stab.unstable} collapsed=${stab.collapsed}`,
    [
      `class=${stab.class}`,
      `score=${fmt(stab.score)}`,
      `unstable=${stab.unstable ? 'yes' : 'no'}`,
      `collapsed=${stab.collapsed ? 'yes' : 'no'}`,
    ],
  );
}

export function explainMetaCertification(cert: MetaCertification | RuntimeMetaCertification): MetaExplanation {
  return make(
    'certification',
    `rank=${cert.rank} safe=${cert.safe} confidence=${fmt(cert.confidence)} reasons=${cert.reasons.length}`,
    [
      `rank=${cert.rank}`,
      `safe=${cert.safe ? 'yes' : 'no'}`,
      `confidence=${fmt(cert.confidence)}`,
      `reasonCount=${cert.reasons.length}`,
      ...cert.reasons.slice().sort().map((r) => `reason=${r}`),
    ],
  );
}

export function explainMetaDeterminism(rep: MetaDeterminismReport): MetaExplanation {
  return make(
    'determinism',
    `verdict=${rep.verdict} byteEquivalent=${rep.byteEquivalent} orderingStable=${rep.orderingStable} mutationLeakage=${rep.mutationLeakage}`,
    [
      `verdict=${rep.verdict}`,
      `signature=${rep.signature}`,
      `replaySignature=${rep.replaySignature}`,
      `byteEquivalent=${rep.byteEquivalent ? 'yes' : 'no'}`,
      `orderingStable=${rep.orderingStable ? 'yes' : 'no'}`,
      `mutationLeakage=${rep.mutationLeakage ? 'yes' : 'no'}`,
    ],
  );
}

export function explainMetaEquivalence(rep: MetaEquivalenceReport): MetaExplanation {
  return make(
    'equivalence',
    `mode=${rep.mode} equivalent=${rep.equivalent} scoreDelta=${fmt(rep.scoreDelta)}`,
    [
      `mode=${rep.mode}`,
      `equivalent=${rep.equivalent ? 'yes' : 'no'}`,
      `leftSignature=${rep.leftSignature}`,
      `rightSignature=${rep.rightSignature}`,
      `scoreDelta=${fmt(rep.scoreDelta)}`,
    ],
  );
}

export const __meta_explainers_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
