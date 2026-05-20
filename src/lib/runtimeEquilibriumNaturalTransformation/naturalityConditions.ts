import type { NaturalComponent, RuntimeNaturalityConditions } from './naturalTransformationTypes';

export function buildNaturalityConditions(comps: readonly NaturalComponent[]): RuntimeNaturalityConditions {
  if (comps.length === 0) return Object.freeze({ satisfied: true, score: 1, violations: 0 });
  const score = comps.reduce((a, c) => a + (c.naturality + c.commutativity) / 2, 0) / comps.length;
  const violations = comps.filter((c) => c.naturality < 0.5 || c.commutativity < 0.5).length;
  const satisfied = violations === 0 && score >= 0.85;
  return Object.freeze({ satisfied, score, violations });
}
