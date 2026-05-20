import type { EquivalenceClass, FunctorObject, RuntimeFunctorEquivalence } from './functorTypes';

export function buildFunctorEquivalence(objs: readonly FunctorObject[]): RuntimeFunctorEquivalence {
  if (objs.length === 0) return Object.freeze({ class: 'EQUIVALENT', strength: 1, regressed: false, fractured: false });
  const avg = objs.reduce((a, o) => a + (o.preservation + o.identity + o.determinism) / 3, 0) / objs.length;
  const variance = objs.reduce((a, o) => {
    const v = (o.preservation + o.identity + o.determinism) / 3;
    return a + (v - avg) * (v - avg);
  }, 0) / objs.length;
  const strength = Math.max(0, 1 - variance);
  let cls: EquivalenceClass = 'EQUIVALENT';
  if (strength <= 0.2) cls = 'FRACTURED';
  else if (strength < 0.5) cls = 'REGRESSED';
  else if (strength < 0.85) cls = 'WEAK';
  return Object.freeze({ class: cls, strength, regressed: cls === 'REGRESSED' || cls === 'FRACTURED', fractured: cls === 'FRACTURED' });
}
