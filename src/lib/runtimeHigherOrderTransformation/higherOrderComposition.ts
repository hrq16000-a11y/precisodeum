import type { CompositionClass, HigherOrderComponent, RuntimeHigherOrderComposition } from './higherOrderTypes';

export function calculateHigherOrderAssociativity(comps: readonly HigherOrderComponent[]): number {
  if (comps.length === 0) return 1;
  return comps.reduce((a, c) => a + c.naturality * c.functoriality, 0) / comps.length;
}

export function classifyHigherOrderComposition(assoc: number): CompositionClass {
  if (assoc <= 0.05) return 'NON_ASSOCIATIVE';
  if (assoc < 0.3) return 'BROKEN';
  if (assoc < 0.5) return 'PARTIAL';
  if (assoc < 0.8) return 'WEAK';
  return 'ASSOCIATIVE';
}

export function buildHigherOrderComposition(comps: readonly HigherOrderComponent[]): RuntimeHigherOrderComposition {
  const associativity = calculateHigherOrderAssociativity(comps);
  const cls = classifyHigherOrderComposition(associativity);
  const broken = cls === 'BROKEN' || cls === 'NON_ASSOCIATIVE';
  return Object.freeze({ class: cls, associativity, broken, failed: broken });
}
