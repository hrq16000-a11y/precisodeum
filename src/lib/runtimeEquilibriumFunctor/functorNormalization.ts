import type { FunctorObject, NormalizationClass, RuntimeFunctorNormalization } from './functorTypes';

export function buildFunctorNormalization(objs: readonly FunctorObject[]): RuntimeFunctorNormalization {
  if (objs.length === 0) return Object.freeze({ class: 'IDEMPOTENT', stability: 1, idempotent: true, divergent: false });
  const stability = objs.reduce((a, o) => a + o.stability, 0) / objs.length;
  let cls: NormalizationClass = 'IDEMPOTENT';
  if (stability <= 0.1) cls = 'DIVERGENT';
  else if (stability < 0.4) cls = 'UNSTABLE';
  else if (stability < 0.8) cls = 'STABLE';
  return Object.freeze({ class: cls, stability, idempotent: cls === 'IDEMPOTENT', divergent: cls === 'DIVERGENT' });
}
