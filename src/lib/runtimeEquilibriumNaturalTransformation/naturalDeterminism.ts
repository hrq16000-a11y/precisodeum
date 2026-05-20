import type { DeterminismClass, NaturalComponent, RuntimeNaturalDeterminism } from './naturalTransformationTypes';

export function buildNaturalDeterminism(comps: readonly NaturalComponent[]): RuntimeNaturalDeterminism {
  if (comps.length === 0) return Object.freeze({ class: 'DETERMINISTIC', score: 1, degraded: false });
  const score = comps.reduce((a, c) => a + c.determinism, 0) / comps.length;
  let cls: DeterminismClass = 'DETERMINISTIC';
  if (score < 0.3) cls = 'NONDETERMINISTIC';
  else if (score < 0.8) cls = 'WEAK';
  return Object.freeze({ class: cls, score, degraded: cls !== 'DETERMINISTIC' });
}
