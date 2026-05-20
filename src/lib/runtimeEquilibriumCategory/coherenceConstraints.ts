import type { CategoryObject, CoherenceClass, RuntimeCoherenceEnvelope, RuntimeFunctorEnvelope } from './categoryTypes';

export function calculateCoherenceBalance(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  return objects.reduce((a, o) => a + o.coherence, 0) / objects.length;
}

export function detectInconsistentFunctorComposition(objects: readonly CategoryObject[], functor: RuntimeFunctorEnvelope): boolean {
  if (objects.length === 0) return false;
  const balance = calculateCoherenceBalance(objects);
  return Math.abs(balance - functor.preservation) > 0.5;
}

export function detectCoherenceCollapse(objects: readonly CategoryObject[]): boolean {
  return calculateCoherenceBalance(objects) <= 0.1;
}

export function buildCoherenceConstraints(objects: readonly CategoryObject[], functor: RuntimeFunctorEnvelope): RuntimeCoherenceEnvelope {
  const balance = calculateCoherenceBalance(objects);
  const collapsing = detectCoherenceCollapse(objects);
  const inconsistent = detectInconsistentFunctorComposition(objects, functor);
  let cls: CoherenceClass = 'COHERENT';
  if (collapsing) cls = 'COLLAPSING';
  else if (inconsistent && balance < 0.3) cls = 'FRACTURED';
  else if (inconsistent) cls = 'INCONSISTENT';
  else if (balance < 0.7) cls = 'WEAKLY_COHERENT';
  return Object.freeze({ class: cls, balance, inconsistent, collapsing });
}
