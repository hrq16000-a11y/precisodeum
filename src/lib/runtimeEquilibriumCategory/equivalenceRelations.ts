import type { CategoryObject, RuntimeEquivalenceRelation } from './categoryTypes';

export function calculateEquivalenceStrength(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  const ref = objects[0];
  let same = 0;
  for (const o of objects) if (Math.abs(o.preservation - ref.preservation) < 0.2 && Math.abs(o.coherence - ref.coherence) < 0.2) same++;
  return same / objects.length;
}

export function detectEquivalenceFracture(objects: readonly CategoryObject[]): boolean {
  return calculateEquivalenceStrength(objects) < 0.4;
}

export function detectRecursiveEquivalence(objects: readonly CategoryObject[]): boolean {
  for (const o of objects) if (o.morphisms.filter((m) => m === o.id).length > 0) return true;
  return false;
}

export function calculateEquivalenceRelations(objects: readonly CategoryObject[]): RuntimeEquivalenceRelation {
  return Object.freeze({ strength: calculateEquivalenceStrength(objects), fractured: detectEquivalenceFracture(objects), recursive: detectRecursiveEquivalence(objects) });
}
