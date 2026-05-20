import type { FunctorObject, IdentityClass, RuntimeFunctorIdentity } from './functorTypes';

export function buildFunctorIdentity(objs: readonly FunctorObject[]): RuntimeFunctorIdentity {
  if (objs.length === 0) return Object.freeze({ class: 'PRESERVED', preservation: 1, violations: 0, broken: false });
  const preservation = objs.reduce((a, o) => a + o.identity, 0) / objs.length;
  const violations = objs.filter((o) => o.identity <= 0.1).length;
  let cls: IdentityClass = 'PRESERVED';
  if (preservation <= 0.1) cls = 'BROKEN';
  else if (preservation < 0.7) cls = 'WEAK';
  return Object.freeze({ class: cls, preservation, violations, broken: cls === 'BROKEN' });
}
