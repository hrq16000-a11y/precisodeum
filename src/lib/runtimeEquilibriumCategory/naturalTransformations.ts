import type { CategoryObject, RuntimeTransformationGraph, TransformationClass } from './categoryTypes';

export function calculateTransformationConsistency(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  return objects.reduce((a, o) => a + (o.coherence + o.preservation) / 2, 0) / objects.length;
}

export function detectBrokenTransformation(objects: readonly CategoryObject[]): boolean {
  if (objects.length === 0) return false;
  return objects.some((o) => o.coherence <= 0 && o.preservation <= 0.2);
}

export function detectNonNaturalTransformation(objects: readonly CategoryObject[]): boolean {
  if (objects.length === 0) return false;
  let nonNat = 0;
  for (const o of objects) if (Math.abs(o.preservation - o.coherence) > 0.6) nonNat++;
  return nonNat / objects.length > 0.4;
}

export function buildNaturalTransformation(objects: readonly CategoryObject[]): RuntimeTransformationGraph {
  const consistency = calculateTransformationConsistency(objects);
  const broken = detectBrokenTransformation(objects);
  const nonNatural = detectNonNaturalTransformation(objects);
  let cls: TransformationClass = 'NATURAL';
  if (broken) cls = 'BROKEN';
  else if (nonNatural) cls = 'NON_NATURAL';
  else if (consistency < 0.4) cls = 'PARTIAL';
  else if (consistency < 0.75) cls = 'WEAK';
  return Object.freeze({ class: cls, consistency, broken, nonNatural });
}
