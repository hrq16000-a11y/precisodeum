import type { NaturalComponent, ReductionClass, RuntimeNaturalReduction } from './naturalTransformationTypes';

export function buildNaturalReduction(comps: readonly NaturalComponent[]): RuntimeNaturalReduction {
  if (comps.length === 0) return Object.freeze({ class: 'IDEMPOTENT', idempotent: true, score: 1 });
  const score = comps.reduce((a, c) => a + Math.min(c.naturality, c.stability), 0) / comps.length;
  let cls: ReductionClass = 'IDEMPOTENT';
  if (score < 0.3) cls = 'UNSTABLE';
  else if (score < 0.8) cls = 'STABLE';
  return Object.freeze({ class: cls, idempotent: cls === 'IDEMPOTENT', score });
}
