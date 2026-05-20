import type { RuntimeHigherOrderComposition, RuntimeHigherOrderEnvelope, RuntimeHigherOrderFunctoriality, RuntimeHigherOrderIdentity, RuntimeHigherOrderNaturality, RuntimeHigherOrderTopology, RuntimeHigherOrderTransformation, RuntimeTransformationLifting } from './higherOrderTypes';

export function explainHigherOrderTransformation(t: RuntimeHigherOrderTransformation): string {
  return `higher-order[class=${t.class},score=${t.score.toFixed(3)},collapsed=${t.collapsed},n=${t.components.length}]`;
}
export function explainHigherOrderComposition(c: RuntimeHigherOrderComposition): string {
  return `composition[class=${c.class},assoc=${c.associativity.toFixed(3)},broken=${c.broken}]`;
}
export function explainHigherOrderIdentity(i: RuntimeHigherOrderIdentity): string {
  return `identity[class=${i.class},pres=${i.preservation.toFixed(3)},violations=${i.violations}]`;
}
export function explainHigherOrderTopology(t: RuntimeHigherOrderTopology): string {
  return `topology[class=${t.class},connectivity=${t.connectivity.toFixed(3)},collapsed=${t.collapsed}]`;
}
export function explainHigherOrderNaturality(n: RuntimeHigherOrderNaturality): string {
  return `naturality[class=${n.class},score=${n.score.toFixed(3)},broken=${n.broken}]`;
}
export function explainHigherOrderFunctoriality(f: RuntimeHigherOrderFunctoriality): string {
  return `functoriality[class=${f.class},score=${f.score.toFixed(3)},failed=${f.failed}]`;
}
export function explainTransformationLifting(l: RuntimeTransformationLifting): string {
  return `lifting[class=${l.class},score=${l.score.toFixed(3)},unliftable=${l.unliftable}]`;
}
export function explainHigherOrderEnvelope(e: RuntimeHigherOrderEnvelope): string {
  return `envelope[id=${e.id},stable=${e.stable},score=${e.score.toFixed(3)},safe=${e.certification.safe}]`;
}
