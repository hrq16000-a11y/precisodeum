import type { HigherOrderCertification, HigherOrderComponent, HigherOrderRisk, RuntimeHigherOrderComposition, RuntimeHigherOrderDeterminism, RuntimeHigherOrderEquivalence, RuntimeHigherOrderFunctoriality, RuntimeHigherOrderIdentity, RuntimeHigherOrderNaturality, RuntimeHigherOrderNormalization, RuntimeHigherOrderStability, RuntimeHigherOrderTopology, RuntimeHigherOrderTransformation, RuntimeTransformationLifting } from './higherOrderTypes';

export interface CertifyHigherOrderInput {
  readonly components: readonly HigherOrderComponent[];
  readonly transformation: RuntimeHigherOrderTransformation;
  readonly composition: RuntimeHigherOrderComposition;
  readonly identity: RuntimeHigherOrderIdentity;
  readonly normalization: RuntimeHigherOrderNormalization;
  readonly determinism: RuntimeHigherOrderDeterminism;
  readonly equivalence: RuntimeHigherOrderEquivalence;
  readonly topology: RuntimeHigherOrderTopology;
  readonly stability: RuntimeHigherOrderStability;
  readonly naturality: RuntimeHigherOrderNaturality;
  readonly functoriality: RuntimeHigherOrderFunctoriality;
  readonly lifting: RuntimeTransformationLifting;
}

export function detectUnsafeHigherOrderState(comps: readonly HigherOrderComponent[]): string[] {
  const r: string[] = [];
  for (const c of comps) {
    if (c.liveExecutionEnabled !== false) r.push(`live:${c.id}`);
    if (c.retryEnabled !== false) r.push(`retry:${c.id}`);
    if (c.backgroundEnabled !== false) r.push(`bg:${c.id}`);
    if (c.realUsersAllowed !== false) r.push(`users:${c.id}`);
    if (c.stage !== 'STAGE_0_READ_ONLY') r.push(`stage:${c.id}`);
  }
  return r;
}

export function calculateHigherOrderConfidence(i: CertifyHigherOrderInput): number {
  const p = [i.transformation.score, i.composition.associativity, i.identity.preservation, i.normalization.stability, i.determinism.score, i.equivalence.strength, i.topology.connectivity, i.stability.score, i.naturality.score, i.functoriality.score, i.lifting.score];
  return p.reduce((a, b) => a + b, 0) / p.length;
}

export function certifyHigherOrderStability(i: CertifyHigherOrderInput): HigherOrderCertification {
  const unsafe = detectUnsafeHigherOrderState(i.components);
  const confidence = calculateHigherOrderConfidence(i);
  const reasons: string[] = [...unsafe];
  if (i.transformation.collapsed) reasons.push('transformation_collapsed');
  if (i.composition.broken) reasons.push('composition_broken');
  if (i.identity.broken) reasons.push('identity_broken');
  if (i.normalization.divergent) reasons.push('normalization_divergent');
  if (i.determinism.degraded) reasons.push('determinism_degraded');
  if (i.equivalence.fractured) reasons.push('equivalence_fractured');
  if (i.topology.collapsed) reasons.push('topology_collapsed');
  if (i.stability.collapsed) reasons.push('stability_collapsed');
  if (i.naturality.broken) reasons.push('naturality_broken');
  if (i.functoriality.failed) reasons.push('functoriality_failed');
  if (i.lifting.unliftable) re