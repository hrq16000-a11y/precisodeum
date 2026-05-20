import type { CategoryObject, RuntimeIdentityEnvelope } from './categoryTypes';

export function calculateIdentityPreservation(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  return objects.reduce((a, o) => a + o.identity, 0) / objects.length;
}

export function detectIdentityViolation(objects: readonly CategoryObject[]): number {
  return objects.filter((o) => o.identity < 0.3).length;
}

export function normalizeIdentityMappings(objects: readonly CategoryObject[]): readonly string[] {
  return Object.freeze([...objects.map((o) => `${o.id}:${o.identity.toFixed(2)}`)].sort());
}

export function buildIdentityMorphisms(objects: readonly CategoryObject[]): RuntimeIdentityEnvelope {
  const preservation = calculateIdentityPreservation(objects);
  const violations = detectIdentityViolation(objects);
  const normalized = violations === 0 && preservation >= 0.7;
  return Object.freeze({ preservation, violations, normalized });
}
