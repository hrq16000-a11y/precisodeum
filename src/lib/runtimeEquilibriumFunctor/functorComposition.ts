import type { CompositionClass, FunctorObject, RuntimeFunctorComposition } from './functorTypes';

export function calculateAssociativity(objs: readonly FunctorObject[]): number {
  if (objs.length === 0) return 1;
  return objs.reduce((a, o) => a + (o.preservation * o.identity), 0) / objs.length;
}

export function classifyComposition(assoc: number): CompositionClass {
  if (assoc <= 0.05) return 'NON_ASSOCIATIVE';
  if (assoc < 0.3) return 'BROKEN';
  if (assoc < 0.5) return 'PARTIAL';
  if (assoc < 0.8) return 'WEAK';
  return 'ASSOCIATIVE';
}

export function buildFunctorComposition(objs: readonly FunctorObject[]): RuntimeFunctorComposition {
  const associativity = calculateAssociativity(objs);
  const cls = classifyComposition(associativity);
  const broken = cls === 'BROKEN' || cls === 'NON_ASSOCIATIVE';
  return Object.freeze({ class: cls, associativity, broken, failed: broken });
}
