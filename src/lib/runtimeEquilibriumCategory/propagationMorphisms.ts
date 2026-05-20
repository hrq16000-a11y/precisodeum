import type { CategoryObject, MorphismsPropagation, RuntimePropagationMorphisms } from './categoryTypes';

export function calculateMorphismsContainment(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  const total = objects.reduce((a, o) => a + o.morphisms.length, 0);
  if (total === 0) return 1;
  return Math.max(0, Math.min(1, 1 - total / (objects.length * 8)));
}

export function detectInfiniteMorphisms(objects: readonly CategoryObject[]): boolean {
  if (objects.length === 0) return false;
  return objects.some((o) => o.morphisms.length > 32);
}

export function detectRecursivePropagationMorphisms(objects: readonly CategoryObject[]): boolean {
  const ids = new Set(objects.map((o) => o.id));
  for (const o of objects) {
    if (o.morphisms.includes(o.id)) return true;
    let depth = 0;
    let cursor: string | undefined = o.morphisms[0];
    const seen = new Set<string>();
    while (cursor && ids.has(cursor) && depth < 32) {
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      const next = objects.find((x) => x.id === cursor);
      cursor = next?.morphisms[0];
      depth++;
    }
  }
  return false;
}

export function buildPropagationMorphisms(objects: readonly CategoryObject[]): RuntimePropagationMorphisms {
  const length = objects.reduce((a, o) => a + o.morphisms.length, 0);
  const containment = calculateMorphismsContainment(objects);
  const infinite = detectInfiniteMorphisms(objects);
  const recursive = detectRecursivePropagationMorphisms(objects);
  let propagation: MorphismsPropagation = 'ISOLATED';
  if (infinite) propagation = 'INFINITE';
  else if (recursive || containment < 0.2) propagation = 'ESCALATING';
  else if (containment < 0.5) propagation = 'DISTRIBUTED';
  else if (length > 0) propagation = 'CONTAINED';
  return Object.freeze({ propagation, length, containment, recursive, infinite });
}
