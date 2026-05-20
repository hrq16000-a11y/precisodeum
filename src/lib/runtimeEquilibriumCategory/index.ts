export * from './categoryTypes';
export * from './stabilityCategory';
export * from './runtimeFunctors';
export * from './naturalTransformations';
export * from './propagationMorphisms';
export * from './categoricalComposition';
export * from './identityMorphisms';
export * from './equivalenceRelations';
export * from './coherenceConstraints';
export * from './functorialCollapse';
export * from './categoryCertification';
export * from './aggregation';
export * from './categoryAdapters';
export * from './categoryObservability';
export * from './categoryExplainers';
export * from './categoryGuards';
export * from './assertCategoryIntegrity';

import { buildStabilityCategory } from './stabilityCategory';
import { buildRuntimeFunctor } from './runtimeFunctors';
import { buildNaturalTransformation } from './naturalTransformations';
import { buildPropagationMorphisms } from './propagationMorphisms';
import { composeRuntimeMorphisms } from './categoricalComposition';
import { buildIdentityMorphisms } from './identityMorphisms';
import { calculateEquivalenceRelations } from './equivalenceRelations';
import { buildCoherenceConstraints } from './coherenceConstraints';
import { detectFunctorialCollapse } from './functorialCollapse';
import { assertCategorySafety, certifyCategoryStability } from './categoryCertification';
import type { CategoryObject, RuntimeCategoryEnvelope } from './categoryTypes';

export function buildCategoryEnvelope(id: string, objects: readonly CategoryObject[]): RuntimeCategoryEnvelope {
  const category = buildStabilityCategory(objects);
  const functor = buildRuntimeFunctor(category.objects);
  const transformation = buildNaturalTransformation(category.objects);
  const morphisms = buildPropagationMorphisms(category.objects);
  const composition = composeRuntimeMorphisms(category.objects);
  const identity = buildIdentityMorphisms(category.objects);
  const equivalence = calculateEquivalenceRelations(category.objects);
  const coherence = buildCoherenceConstraints(category.objects, functor);
  const collapse = detectFunctorialCollapse(category, functor, morphisms, coherence);
  const certification = certifyCategoryStability({ objects: category.objects, category, functor, transformation, morphisms, coherence, collapse });
  const risks = assertCategorySafety(certification);
  const score = (category.balance + functor.preservation + transformation.consistency + morphisms.containment + coherence.balance + identity.preservation) / 6;
  const stable = !category.collapsed && !collapse.irrecoverable && !morphisms.infinite && !coherence.collapsing && certification.safe;
  return Object.freeze({ id, category, functor, transformation, morphisms, coherence, equivalence, identity, composition, collapse, certification, risks, score, stable });
}
