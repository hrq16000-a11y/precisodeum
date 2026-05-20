import type { CategoryObject, FunctorClass, RuntimeFunctorEnvelope } from './categoryTypes';

export function calculateFunctorPreservation(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  return objects.reduce((a, o) => a + o.preservation, 0) / objects.length;
}

export function detectFunctorDegeneration(objects: readonly CategoryObject[]): boolean {
  if (objects.length === 0) return false;
  return objects.every((o) => o.preservation <= 0.1);
}

export function detectRecursiveFunctor(objects: readonly CategoryObject[]): boolean {
  for (const o of objects) if (o.morphisms.includes(o.id)) return true;
  return false;
}

export function buildRuntimeFunctor(objects: readonly CategoryObject[]): RuntimeFunctorEnvelope {
  const preservation = calculateFunctorPreservation(objects);
  const degenerate = detectFunctorDegeneration(objects);
  const recursive = detectRecursiveFunctor(objects);
  let cls: FunctorClass = 'PRESERVING';
  if (degenerate) cls = 'DEGENERATE';
  else if (recursive) cls = 'RECURSIVE';
  else if (preservation < 0.3) cls = 'DISTORTING';
  else if (preservation < 0.7) cls = 'WEAKLY_PRESERVING';
  return Object.freeze({ class: cls, preservation, recursive, degenerate });
}
