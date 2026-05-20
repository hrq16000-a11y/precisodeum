import type { RuntimeCommutativeDiagram, RuntimeNaturalComposition, RuntimeNaturalEnvelope, RuntimeNaturalIdentity, RuntimeNaturalTopology, RuntimeNaturalTransformation } from './naturalTransformationTypes';

export function explainTransformation(t: RuntimeNaturalTransformation): string {
  return `transformation[class=${t.class},nat=${t.naturality.toFixed(3)},collapsed=${t.collapsed},n=${t.components.length}]`;
}
export function explainComposition(c: RuntimeNaturalComposition): string {
  return `composition[class=${c.class},assoc=${c.associativity.toFixed(3)},broken=${c.broken}]`;
}
export function explainIdentity(i: RuntimeNaturalIdentity): string {
  return `identity[class=${i.class},pres=${i.preservation.toFixed(3)},violations=${i.violations}]`;
}
export function explainTopology(t: RuntimeNaturalTopology): string {
  return `topology[class=${t.class},connectivity=${t.connectivity.toFixed(3)},collapsed=${t.collapsed}]`;
}
export function explainDiagram(d: RuntimeCommutativeDiagram): string {
  return `diagram[class=${d.class},comm=${d.commutativity.toFixed(3)},failed=${d.failed}]`;
}
export function explainEnvelope(e: RuntimeNaturalEnvelope): string {
  return `envelope[id=${e.id},stable=${e.stable},score=${e.score.toFixed(3)},safe=${e.certification.safe}]`;
}
