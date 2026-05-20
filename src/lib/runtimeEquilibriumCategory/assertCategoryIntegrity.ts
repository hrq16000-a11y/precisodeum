import { buildCategoryEnvelope } from './index';
import { buildDefaultCategoryInputs } from './categoryAdapters';
import { assertCategoryCertificationIntegrity, assertCategoryDeterminism, assertCategoryReadonly, assertNoCategoryMutation, assertNoCoherenceCollapse, assertNoFunctorDegeneration, assertNoInfiniteMorphisms, assertNoIrrecoverableCategoryCollapse, type CategoryGuardViolation } from './categoryGuards';

export function assertAllCategoryIntegrity(): readonly CategoryGuardViolation[] {
  const objs = buildDefaultCategoryInputs();
  const a = buildCategoryEnvelope('integrity-a', objs);
  const b = buildCategoryEnvelope('integrity-a', objs);
  const out: CategoryGuardViolation[] = [];
  out.push(...assertCategoryReadonly(objs));
  out.push(...assertCategoryDeterminism(a.category.signature, b.category.signature));
  out.push(...assertNoCategoryMutation(a, a));
  out.push(...assertNoInfiniteMorphisms(a.morphisms));
  out.push(...assertNoCoherenceCollapse(a.coherence));
  out.push(...assertNoFunctorDegeneration(a.functor));
  out.push(...assertNoIrrecoverableCategoryCollapse(a.collapse));
  out.push(...assertCategoryCertificationIntegrity(a.certification));
  return Object.freeze(out);
}
