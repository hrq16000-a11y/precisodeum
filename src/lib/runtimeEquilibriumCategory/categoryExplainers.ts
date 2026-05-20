import type { RuntimeCoherenceEnvelope, RuntimeEquivalenceRelation, RuntimeFunctorEnvelope, RuntimePropagationMorphisms, RuntimeStabilityCategory, RuntimeTransformationGraph } from './categoryTypes';

export function explainCategory(c: RuntimeStabilityCategory): string { return `category:${c.classification} balance=${c.balance.toFixed(2)} objects=${c.objects.length}${c.collapsed ? ' [collapsed]' : ''}`; }
export function explainFunctor(f: RuntimeFunctorEnvelope): string { return `functor:${f.class} preservation=${f.preservation.toFixed(2)}${f.recursive ? ' [recursive]' : ''}${f.degenerate ? ' [degenerate]' : ''}`; }
export function explainTransformation(t: RuntimeTransformationGraph): string { return `transformation:${t.class} consistency=${t.consistency.toFixed(2)}${t.broken ? ' [broken]' : ''}${t.nonNatural ? ' [non-natural]' : ''}`; }
export function explainMorphisms(m: RuntimePropagationMorphisms): string { return `morphisms:${m.propagation} length=${m.length} containment=${m.containment.toFixed(2)}${m.recursive ? ' [recursive]' : ''}${m.infinite ? ' [infinite]' : ''}`; }
export function explainCoherence(c: RuntimeCoherenceEnvelope): string { return `coherence:${c.class} balance=${c.balance.toFixed(2)}${c.inconsistent ? ' [inconsistent]' : ''}${c.collapsing ? ' [collapsing]' : ''}`; }
export function explainEquivalence(e: RuntimeEquivalenceRelation): string { return `equivalence: strength=${e.strength.toFixed(2)}${e.fractured ? ' [fractured]' : ''}${e.recursive ? ' [recursive]' : ''}`; }
