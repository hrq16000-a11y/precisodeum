import type { EquivalenceClass, NaturalComponent, RuntimeNaturalEquivalence } from './naturalTransformationTypes';

export function buildNaturalEquivalence(comps: readonly NaturalComponent[]): RuntimeNaturalEquivalence {
  if (comps.length === 0) return Object.freeze({ class: 'EQUIVALENT', strength: 1, regressed: false, fractured: false });
  const avg = comps.reduce((a, c) => a + (c.naturality + c.identity + c.determinism) / 3, 0) / comps.length;
  const variance = comps.reduce((a, c) => {
    const v = (c.naturality + c.identity + c.determinism) / 3;
    return a + (v - avg) * (v - avg);
  }, 0) / comps.length;
  const strength = Math.max(0, 1 - variance);
  let cls: EquivalenceClass = 'EQUIVALENT';
  if (strength <= 0.2) cls = 'FRACTURED';
  else if (strength < 0.5) cls = 'REGRESSED';
  else if (strength < 0.85) cls = 'WEAK';
  return Object.freeze({ class: cls, strength, regressed: cls === 'REGRESSED' || cls === 'FRACTURED', fractured: cls === 'FRACTURED' });
}
