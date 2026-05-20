import type { FunctorObject, ReductionClass, RuntimeFunctorReduction } from './functorTypes';

export function buildFunctorReduction(objs: readonly FunctorObject[]): RuntimeFunctorReduction {
  if (objs.length === 0) return Object.freeze({ class: 'IDEMPOTENT', idempotent: true, score: 1 });
  const score = objs.reduce((a, o) => a + Math.min(o.preservation, o.stability), 0) / objs.length;
  let cls: ReductionClass = 'IDEMPOTENT';
  if (score < 0.3) cls = 'UNSTABLE';
  else if (score < 0.8) cls = 'STABLE';
  return Object.freeze({ class: cls, idempotent: cls === 'IDEMPOTENT', score });
}
