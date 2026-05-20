import type { DeterminismClass, FunctorObject, RuntimeFunctorDeterminism } from './functorTypes';

export function buildFunctorDeterminism(objs: readonly FunctorObject[]): RuntimeFunctorDeterminism {
  if (objs.length === 0) return Object.freeze({ class: 'DETERMINISTIC', score: 1, degraded: false });
  const score = objs.reduce((a, o) => a + o.determinism, 0) / objs.length;
  let cls: DeterminismClass = 'DETERMINISTIC';
  if (score < 0.3) cls = 'NONDETERMINISTIC';
  else if (score < 0.8) cls = 'WEAK';
  return Object.freeze({ class: cls, score, degraded: cls !== 'DETERMINISTIC' });
}
