import type { NaturalComponent, NormalizationClass, RuntimeNaturalNormalization } from './naturalTransformationTypes';

export function buildNaturalNormalization(comps: readonly NaturalComponent[]): RuntimeNaturalNormalization {
  if (comps.length === 0) return Object.freeze({ class: 'IDEMPOTENT', stability: 1, idempotent: true, divergent: false });
  const stability = comps.reduce((a, c) => a + c.stability, 0) / comps.length;
  let cls: NormalizationClass = 'IDEMPOTENT';
  if (stability <= 0.1) cls = 'DIVERGENT';
  else if (stability < 0.4) cls = 'UNSTABLE';
  else if (stability < 0.8) cls = 'STABLE';
  return Object.freeze({ class: cls, stability, idempotent: cls === 'IDEMPOTENT', divergent: cls === 'DIVERGENT' });
}
