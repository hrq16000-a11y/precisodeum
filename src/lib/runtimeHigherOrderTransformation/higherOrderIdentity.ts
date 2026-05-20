import type { HigherOrderComponent, IdentityClass, RuntimeHigherOrderIdentity } from './higherOrderTypes';

export function buildHigherOrderIdentity(comps: readonly HigherOrderComponent[]): RuntimeHigherOrderIdentity {
  if (comps.length === 0) return Object.freeze({ class: 'PRESERVED', preservation: 1, violations: 0, broken: false });
  const preservation = comps.reduce((a, c) => a + c.identity, 0) / comps.length;
  const violations = comps.filter((c) => c.identity <= 0.1).length;
  let cls: IdentityClass = 'PRESERVED';
  if (preservation <= 0.1) cls = 'BROKEN';
  else if (preservation < 0.7) cls = 'WEAK';
  return Object.freeze({ class: cls, preservation, violations, broken: cls === 'BROKEN' });
}
