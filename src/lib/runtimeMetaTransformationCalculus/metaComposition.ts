// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Composition
// Pure, deterministic, associative-style composition over meta transformations.

import type {
  MetaCompositionClass,
  RuntimeMetaComposition,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

function classify(score: number, broken: boolean): MetaCompositionClass {
  if (broken) return 'BROKEN';
  if (score >= 0.9) return 'ASSOCIATIVE';
  if (score >= 0.7) return 'WEAK';
  if (score >= 0.4) return 'PARTIAL';
  return 'NON_ASSOCIATIVE';
}

export function composeMetaTransformations(
  parts: readonly RuntimeMetaTransformation[],
): RuntimeMetaComposition {
  if (parts.length === 0) {
    return deepFreeze({ class: 'NON_ASSOCIATIVE', associativity: 0, broken: true, failed: true });
  }
  const ordered = parts.slice().sort((a, b) => (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0));

  let sum = 0;
  let anyCollapsed = false;
  for (const p of ordered) {
    sum += p.score;
    if (p.collapsed) anyCollapsed = true;
  }
  const avg = sum / ordered.length;

  // Associativity proxy: deterministic — sorted vs reverse-sorted produces same canonical score
  const reverse = ordered.slice().reverse();
  let revSum = 0;
  for (const p of reverse) revSum += p.score;
  const reverseAvg = revSum / reverse.length;
  const associativity = Math.max(0, 1 - Math.abs(avg - reverseAvg));

  const broken = anyCollapsed || avg < 0.35;
  const klass = classify(Math.min(avg, associativity), broken);
  const failed = klass === 'BROKEN' || klass === 'NON_ASSOCIATIVE';

  const envelope: RuntimeMetaComposition = {
    class: klass,
    associativity: Math.round(associativity * 1e6) / 1e6,
    broken,
    failed,
  };
  return deepFreeze(envelope);
}

export function metaCompositionEquivalent(
  a: RuntimeMetaComposition,
  b: RuntimeMetaComposition,
): boolean {
  return a.class === b.class && a.broken === b.broken && a.failed === b.failed && Math.abs(a.associativity - b.associativity) < 1e-6;
}

export const __meta_composition_internals = deepFreeze({
  stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
