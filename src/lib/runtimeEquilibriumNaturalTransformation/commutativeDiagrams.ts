import type { DiagramClass, NaturalComponent, RuntimeCommutativeDiagram } from './naturalTransformationTypes';

export function buildCommutativeDiagram(comps: readonly NaturalComponent[]): RuntimeCommutativeDiagram {
  if (comps.length === 0) return Object.freeze({ class: 'COMMUTATIVE', commutativity: 1, failed: false });
  const commutativity = comps.reduce((a, c) => a + c.commutativity, 0) / comps.length;
  let cls: DiagramClass = 'COMMUTATIVE';
  if (commutativity <= 0.1) cls = 'BROKEN';
  else if (commutativity < 0.5) cls = 'PARTIAL';
  else if (commutativity < 0.85) cls = 'WEAK';
  const failed = cls === 'BROKEN';
  return Object.freeze({ class: cls, commutativity, failed });
}
