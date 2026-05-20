import type { RuntimeCoherenceEnvelope, RuntimeFunctorEnvelope, RuntimeFunctorialCollapse, RuntimePropagationMorphisms, RuntimeStabilityCategory } from './categoryTypes';

export function detectRecursiveCollapse(functor: RuntimeFunctorEnvelope, morphisms: RuntimePropagationMorphisms): boolean {
  return functor.recursive && morphisms.recursive;
}

export function detectIrrecoverableFunctorBreak(category: RuntimeStabilityCategory, coherence: RuntimeCoherenceEnvelope): boolean {
  return category.collapsed || coherence.class === 'COLLAPSING';
}

export function calculateCollapseContainment(morphisms: RuntimePropagationMorphisms, coherence: RuntimeCoherenceEnvelope): number {
  return Math.max(0, Math.min(1, (morphisms.containment + coherence.balance) / 2));
}

export function detectFunctorialCollapse(category: RuntimeStabilityCategory, functor: RuntimeFunctorEnvelope, morphisms: RuntimePropagationMorphisms, coherence: RuntimeCoherenceEnvelope): RuntimeFunctorialCollapse {
  const recursive = detectRecursiveCollapse(functor, morphisms);
  const irrecoverable = detectIrrecoverableFunctorBreak(category, coherence);
  const collapsing = irrecoverable || functor.degenerate || morphisms.infinite || coherence.collapsing;
  const containment = calculateCollapseContainment(morphisms, coherence);
  return Object.freeze({ collapsing, recursive, irrecoverable, containment });
}
