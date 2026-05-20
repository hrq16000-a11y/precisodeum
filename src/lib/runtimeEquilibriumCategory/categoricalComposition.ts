import type { CategoryObject, RuntimeCompositionEnvelope } from './categoryTypes';

export function calculateCompositionEquilibrium(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  return objects.reduce((a, o) => a + (o.preservation + o.coherence + o.identity) / 3, 0) / objects.length;
}

export function detectCompositionInstability(objects: readonly CategoryObject[]): boolean {
  return calculateCompositionEquilibrium(objects) < 0.5;
}

export function detectCompositionFracture(objects: readonly CategoryObject[]): boolean {
  if (objects.length === 0) return false;
  const broken = objects.filter((o) => o.coherence <= 0 || o.identity <= 0).length;
  return broken / objects.length >= 0.5;
}

export function composeRuntimeMorphisms(objects: readonly CategoryObject[]): RuntimeCompositionEnvelope {
  const equilibrium = calculateCompositionEquilibrium(objects);
  const unstable = detectCompositionInstability(objects);
  const fractured = detectCompositionFracture(objects);
  return Object.freeze({ equilibrium, unstable, fractured });
}
