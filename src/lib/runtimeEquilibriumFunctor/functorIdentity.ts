import type { FunctorObject, IdentityClass, RuntimeFunctorIdentity } from './functorTypes';

export function buildFunctorIdentity(objs: readonly FunctorObject[]): RuntimeFunctorIdentity {
  if (objs.length === 0) return Object.freeze({ class: 'PRESERVED', preservation: 1, violations: 0, broken: false });
  const preservation = objs.reduce((a, o) => a + o.identity, 0) / objs.length;
  const violations = objs.filter((o)