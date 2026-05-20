// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Equivalence
// Structural & semantic equivalence over canonical forms. Pure & read-only.

import type { RuntimeMetaTransformation } from './metaTransformationTypes';
import { normalizeMetaTransformation } from './metaNormalization';
import { computeMetaDeterminismSignature } from './metaDeterminism';

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

export type MetaEquivalenceMode = 'STRUCTURAL' | 'SEMANTIC' | 'RELAXED';

export interface MetaEquivalenceReport {
  readonly mode: MetaEquivalenceMode;
  readonly equivalent: boolean;
  readonly leftSignature: string;
  readonly rightSignature: string;
  readonly scoreDelta: number;
}

function canonicalSig(t: RuntimeMetaTransformation): string {
  return computeMetaDeterminismSignature(normalizeMetaTransformation(t));
}

export function metaTransformationsEquivalent(
  a: RuntimeMetaTransformation,
  b: RuntimeMetaTransformation,
  mode: MetaEquivalenceMode = 'STRUCTURAL',
): MetaEquivalenceReport {
  const leftSig = canonicalSig(a);
  const rightSig = canonicalSig(b);
  const scoreDelta = Math.abs(a.score - b.score);

  let equivalent: boolean;
  if (mode === 'STRUCTURAL') {
    equivalent = leftSig === rightSig;
  } else if (mode === 'SEMANTIC') {
    const na = normalizeMetaTransformation(a);
    const nb = normalizeMetaTransformation(b);
    equivalent = na.class === nb.class && Math.abs(na.score - nb.score) < 1e-6 && na.components.length === nb.components.length;
  } else {
    // RELAXED: ignore transient metadata (signatures), compare class + score bucket
    equivalent = a.class === b.class && scoreDelta < 0.05;
  }

  const report: MetaEquivalenceReport = {
    mode,
    equivalent,
    leftSignature: leftSig,
    rightSignature: rightSig,
    scoreDelta: Math.round(scoreDelta * 1e6) / 1e6,
  };
  return deepFreeze(report);
}

export function canonicalCompareMeta(
  a: RuntimeMetaTransformation,
  b: RuntimeMetaTransformation,
): number {
  const la = canonicalSig(a);
  const lb = canonicalSig(b);
  if (la < lb) return -1;
  if (la > lb) return 1;
  return 0;
}

export function isMetaEquivalenceSymmetric(
  a: RuntimeMetaTransformation,
  b: RuntimeMetaTransformation,
  mode: MetaEquivalenceMode = 'STRUCTURAL',
): boolean {
  const ab = metaTransformationsEquivalent(a, b, mode).equivalent;
  const ba = metaTransformationsEquivalent(b, a, mode).equivalent;
  return ab === ba;
}

export function isMetaEquivalenceTransitive(
  a: RuntimeMetaTransformation,
  b: RuntimeMetaTransformation,
  c: RuntimeMetaTransformation,
  mode: MetaEquivalenceMode = 'STRUCTURAL',
): boolean {
  const ab = metaTransformationsEquivalent(a, b, mode).equivalent;
  const bc = metaTransformationsEquivalent(b, c, mode).equivalent;
  const ac = metaTransformationsEquivalent(a, c, mode).equivalent;
  return !(ab && bc) || ac;
}

export const __meta_equivalence_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
