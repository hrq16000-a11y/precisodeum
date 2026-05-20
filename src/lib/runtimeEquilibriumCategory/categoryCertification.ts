import type { CategoryCertification, CategoryObject, CategoryRisk, RuntimeCoherenceEnvelope, RuntimeFunctorEnvelope, RuntimeFunctorialCollapse, RuntimePropagationMorphisms, RuntimeStabilityCategory, RuntimeTransformationGraph } from './categoryTypes';

export interface CertifyInput {
  readonly objects: readonly CategoryObject[];
  readonly category: RuntimeStabilityCategory;
  readonly functor: RuntimeFunctorEnvelope;
  readonly transformation: RuntimeTransformationGraph;
  readonly morphisms: RuntimePropagationMorphisms;
  readonly coherence: RuntimeCoherenceEnvelope;
  readonly collapse: RuntimeFunctorialCollapse;
}

export function detectUnsafeCategoryState(objs: readonly CategoryObject[]): string[] {
  const r: string[] = [];
  for (const o of objs) {
    if (o.liveExecutionEnabled !== false) r.push(`live:${o.id}`);
    if (o.retryEnabled !== false) r.push(`retry:${o.id}`);
    if (o.backgroundEnabled !== false) r.push(`bg:${o.id}`);
    if (o.realUsersAllowed !== false) r.push(`users:${o.id}`);
    if (o.stage !== 'STAGE_0_READ_ONLY') r.push(`stage:${o.id}`);
  }
  return r;
}

export function calculateCategoryConfidence(i: CertifyInput): number {
  const parts = [i.category.balance, i.functor.preservation, i.transformation.consistency, i.morphisms.containment, i.coherence.balance, i.collapse.containment];
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function certifyCategoryStability(i: CertifyInput): CategoryCertification {
  const unsafe = detectUnsafeCategoryState(i.objects);
  const confidence = calculateCategoryConfidence(i);
  const reasons: string[] = [...unsafe];
  if (i.morphisms.infinite) reasons.push('morphisms_infinite');
  if (i.coherence.collapsing) reasons.push('coherence_collapsing');
  if (i.functor.degenerate) reasons.push('functor_degenerate');
  if (i.collapse.irrecoverable) reasons.push('collapse_irrecoverable');
  if (i.transformation.broken) reasons.push('transformation_broken');
  const safe = reasons.length === 0;
  const rank: 'OK' | 'WARN' | 'BLOCKED' = unsafe.length > 0 || i.collapse.irrecoverable || i.morphisms.infinite ? 'BLOCKED' : safe ? 'OK' : 'WARN';
  return Object.freeze({ safe, confidence, rank, reasons: Object.freeze(reasons) });
}

export function assertCategorySafety(c: CategoryCertification): readonly CategoryRisk[] {
  if (c.safe) return Object.freeze([]);
  const sev = c.rank === 'BLOCKED' ? 'critical' : 'error';
  return Object.freeze(c.reasons.map((r) => Object.freeze({ code: 'CATEGORY_UNSAFE', severity: sev as 'critical' | 'error', description: r })));
}
