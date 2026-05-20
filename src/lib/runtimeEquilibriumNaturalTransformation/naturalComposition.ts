import type { CompositionClass, NaturalComponent, RuntimeNaturalComposition } from './naturalTransformationTypes';

export function calculateAssociativity(comps: readonly NaturalComponent[]): number {
  if (comps.length === 0) return 1;
  return comps.reduce((a, c) => a + c.naturality * c.identity, 0) / comps.length;
}

export function classifyComposition(assoc: number): CompositionClass {
  if (assoc <= 0.05) return 'NON_ASSOCIATIVE';
  if (assoc < 0.3) return 'BROKEN';
  if (assoc < 0.5) return 'PARTIAL';
  if (assoc < 0.8) return 'WEAK';
  return 'ASSOCIATIVE';
}

export function buildNaturalComposition(comps: readonly NaturalComponent[]): RuntimeNaturalComposition {
  const associativity = calculateAssociativity(comps);
  const cls = classifyComposition(associativity);
  const broken = cls === 'BROKEN' || cls === 'NON_ASSOCIATIVE';
  return Object.freeze({ class: cls, associativity, broken, failed: broken });
}
