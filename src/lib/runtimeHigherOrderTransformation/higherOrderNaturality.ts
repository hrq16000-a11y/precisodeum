import type { HigherOrderComponent, NaturalityClass, RuntimeHigherOrderNaturality } from './higherOrderTypes';

export function buildHigherOrderNaturality(comps: readonly HigherOrderComponent[]): RuntimeHigherOrderNaturality {
  if (comps.length === 0) return Object.freeze({ class: 'NATURAL', score: 1, violations: 0, broken: false });
  const score = comps.reduce((a, c) => a + c.naturality, 0) / comps.length;
  const violations = comps.filter((c) => c.naturality < 0.5).length;
  let cls: NaturalityClass = 'NATURAL';
  if (score <= 0.1) cls = 'BROKEN';
  else if (score < 0.5) cls = 'PARTIAL';
  else if (score < 0.85) cls = 'WEAK';
  return Object.freeze({ class: cls, score, violations, broken: cls === 'BROKEN' });
}
