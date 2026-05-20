import type { CategoryCertification, CategoryObject, CategoryRisk, RuntimeCategoryEnvelope, RuntimeCoherenceEnvelope, RuntimeFunctorEnvelope, RuntimeFunctorialCollapse, RuntimePropagationMorphisms } from './categoryTypes';

export interface CategoryGuardViolation extends CategoryRisk { readonly envelopeId?: string; }

export function assertCategoryReadonly(objs: readonly CategoryObject[]): CategoryGuardViolation[] {
  const out: CategoryGuardViolation[] = [];
  for (const o of objs) {
    if (o.liveExecutionEnabled !== false || o.retryEnabled !== false || o.backgroundEnabled !== false || o.realUsersAllowed !== false || o.stage !== 'STAGE_0_READ_ONLY') {
      out.push({ code: 'CATEGORY_READONLY_INVARIANT_BROKEN', severity: 'critical', description: `object ${o.id} viola invariantes` });
    }
  }
  return out;
}

export function assertCategoryDeterminism(a: string, b: string): CategoryGuardViolation[] {
  return a === b ? [] : [{ code: 'CATEGORY_NON_DETERMINISTIC', severity: 'error', description: 'assinaturas divergentes' }];
}

export function assertNoCategoryMutation(before: RuntimeCategoryEnvelope, after: RuntimeCategoryEnvelope): CategoryGuardViolation[] {
  if (before === after) return [];
  if (before.category.signature !== after.category.signature) return [{ code: 'CATEGORY_MUTATION_DETECTED', severity: 'critical', description: 'envelope mutado' }];
  return [];
}

export function assertNoInfiniteMorphisms(m: RuntimePropagationMorphisms): CategoryGuardViolation[] {
  return m.infinite ? [{ code: 'CATEGORY_MORPHISMS_INFINITE', severity: 'critical', description: 'morfismos infinitos' }] : [];
}

export function assertNoCoherenceCollapse(c: RuntimeCoherenceEnvelope): CategoryGuardViolation[] {
  return c.collapsing ? [{ code: 'CATEGORY_COHERENCE_COLLAPSING', severity: 'critical', description: 'coerência colapsando' }] : [];
}

export function assertNoFunctorDegeneration(f: RuntimeFunctorEnvelope): CategoryGuardViolation[] {
  return f.degenerate ? [{ code: 'CATEGORY_FUNCTOR_DEGENERATE', severity: 'critical', description: 'functor degenerado' }] : [];
}

export function assertNoIrrecoverableCategoryCollapse(c: RuntimeFunctorialCollapse): CategoryGuardViolation[] {
  return c.irrecoverable ? [{ code: 'CATEGORY_COLLAPSE_IRRECOVERABLE', severity: 'critical', description: 'colapso irreversível' }] : [];
}

export function assertCategoryCertificationIntegrity(c: CategoryCertification): CategoryGuardViolation[] {
  return c.safe ? [] : [{ code: 'CATEGORY_CERTIFICATION_INVALID', severity: c.rank === 'BLOCKED' ? 'critical' : 'error', description: c.reasons.join(',') || 'unsafe' }];
}
