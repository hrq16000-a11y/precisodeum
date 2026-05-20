import type { HigherOrderComponent, LiftingClass, RuntimeTransformationLifting } from './higherOrderTypes';

export function buildTransformationLifting(comps: readonly HigherOrderComponent[]): RuntimeTransformationLifting {
  if (comps.length === 0) return Object.freeze({ class: 'LIFTED', score: 1, unliftable: false });
  const score = comps.reduce((a, c) => a + c.lift, 0) / comps.length;
  let cls: LiftingClass = 'LIFTED';
  if (score <= 0.1) cls = 'UNLIFTABLE';
  else if (score < 0.5) cls = 'PARTIAL';
  else if (score < 0.85) cls = 'WEAK';
  return Object.freeze({ class: cls, score, unliftable: cls === 'UNLIFTABLE' });
}
