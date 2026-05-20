import type { RuntimeEquilibriumFunctor, RuntimeFunctorComposition, RuntimeFunctorEnvelope, RuntimeFunctorIdentity, RuntimeFunctorTopology } from './functorTypes';

export function explainFunctor(f: RuntimeEquilibriumFunctor): string {
  return `functor[class=${f.class},pres=${f.preservation.toFixed(3)},collapsed=${f.collapsed},n=${f.objects.length}]`;
}
export function explainComposition(c: RuntimeFunctorComposition): string {
  return `composition[class=${c.class},assoc=${c.associativity.toFixed(3)},broken=${c.broken}]`;
}
export function explainIdentity(i: RuntimeFunctorIdentity): string {
  return `identity[class=${i.class},pres=${i.preservation.toFixed(3)},violations=${i.violations}]`;
}
export function explainTopology(t: RuntimeFunctorTopology): string {
  return `topology[class=${t.class},connectivity=${t.connectivity.toFixed(3)},collapsed=${t.collapsed}]`;
}
export function explainEnvelope(e: RuntimeFunctorEnvelope): string {
  return `envelope[id=${e.id},stable=${e.stable},score=${e.score.toFixed(3)},safe=${e.certification.safe}]`;
}
