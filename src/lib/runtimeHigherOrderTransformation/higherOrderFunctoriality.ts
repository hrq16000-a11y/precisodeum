import type { FunctorialityClass, HigherOrderComponent, RuntimeHigherOrderFunctoriality } from './higherOrderTypes';

export function buildHigherOrderFunctoriality(comps: readonly HigherOrderComponent[]): RuntimeHigherOrderFunctoriality {
  if (comps.length === 0) return Object.freeze({ class: 'FUNCTORIAL', score: 1, failed: false });
  const score = comps.reduce((a, c) => a + c.functoriality, 0) / comps.length;
  let cls: FunctorialityClass = 'FUNCTORIAL';
  if (score <= 0.1) cls = 'FAILED';
  else if (score < 0.5) cls = 'PARTIAL';
  else if (score < 0.85) cls = 'WEAK';
  return Object.freeze({ class: cls, score, failed: cls === 'FAILED' });
}
