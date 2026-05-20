export * from './higherOrderTypes';
export * from './higherOrderTransformation';
export * from './higherOrderComposition';
export * from './higherOrderIdentity';
export * from './higherOrderNormalization';
export * from './higherOrderDeterminism';
export * from './higherOrderEquivalence';
export * from './higherOrderReduction';
export * from './higherOrderTopology';
export * from './higherOrderStability';
export * from './higherOrderCertification';
export * from './higherOrderNaturality';
export * from './higherOrderFunctoriality';
export * from './transformationLifting';
export * from './aggregation';
export * from './higherOrderAdapters';
export * from './higherOrderObservability';
export * from './explainers';
export * from './higherOrderGuards';

import { buildHigherOrderTransformation } from './higherOrderTransformation';
import { buildHigherOrderComposition } from './higherOrderComposition';
import { buildHigherOrderIdentity } from './higherOrderIdentity';
import { buildHigherOrderNormalization } from './higherOrderNormalization';
import { buildHigherOrderDeterminism } from './higherOrderDeterminism';
import { buildHigherOrderEquivalence } from './higherOrderEquivalence';
import { buildHigherOrderReduction } from './higherOrderReduction';
import { buildHigherOrderTopology } from './higherOrderTopology';
import { buildHigherOrderStability } from './higherOrderStability';
import { buildHigherOrderNaturality } from './higherOrderNaturality';
import { buildHigherOrderFunctoriality } from './higherOrderFunctoriality';
import { buildTransformationLifting } from './transformationLifting';
import { assertHigherOrderSafety, certifyHigherOrderStability } from './higherOrderCertification';
import type { HigherOrderComponent, RuntimeHigherOrderEnvelope } from './higherOrderTypes';

export function buildHigherOrderEnvelope(id: string, components: readonly HigherOrderComponent[]): RuntimeHigherOrderEnvelope {
  const transformation = buildHigherOrderTransformation(components);
  const composition = buildHigherOrderComposition(transformation.components);
  const identity = buildHigherOrderIdentity(transformation.components);
  const normalization = buildHigherOrderNormalization(transformation.components);
  const determinism = buildHigherOrderDeterminism(transformation.components);
  const equivalence = buildHigherOrderEquivalence(transformation.components);
  const reduction = buildHigherOrderReduction(transformation.components);
  const topology = buildHigherOrderTopology(transformation.components);
  const stability = buildHigherOrderStability(composition, identity, normalization, topology);
  const naturality = buildHigherOrderNaturality(transformation.components);
  const functoriality = buildHigherOrderFunctoriality(transformation.components);
  const lifting = buildTransformationLifting(transformation.components);
  const certification = certifyHigherOrderStability({ components: transformation.components, transformation, composition, identity, normalization, determinism, equivalence, topology, stability, naturality, functoriality, lifting });
  const risks = assertHigherOrderSafety(certification);
  const score = (transformation.score + composition.associativity + identity.preservation + normalization.stability + determinism.score + equivalence.strength + reduction.score + topology.connectivity + stability.score + naturality.score + functoriality.score + lifting.score) / 12;
  const stable = !transformation.collapsed && !composition.broken && !identity.broken && !normalization.divergent && !determinism.degraded && !equivalence.fractured && !topology.collapsed && !stability.collapsed && !naturality.broken && !functoriality.failed && !lifting.unliftable && certification.safe;
  return Object.freeze({ id, transformation, composition, identity, normalization, determinism, equivalence, reduction, topology, stability, naturality, functoriality, lifting, certification, risks, score, stable });
}

import { buildDefaultHigherOrderInputs } from './higherOrderAdapters';
import { assertHigherOrderCertificationIntegrity, assertHigherOrderDeterminism, assertHigherOrderReadonly, assertNoHigherOrderCollapse, assertNoHigherOrderCompositionFailure, assertNoHigherOrderDeterminismDegradation, assertNoHigherOrderFunctorialityFailure, assertNoHigherOrderIdentityBreak, assertNoHigherOrderMutation, assertNoHigherOrderNaturalityBreak, assertNoHigherOrderStabilityCollapse, assertNoHigherOrderTopologyCollapse, assertNoUnliftableTransformation, type HigherOrderGuardViolation } from './higherOrderGuards';

export function assertAllHigherOrderIntegrity(): readonly HigherOrderGuardViolation[] {
  const comps = buildDefaultHigherOrderInputs();
  const a = buildHigherOrderEnvelope('integrity-a', comps);
  const b = buildHigherOrderEnvelope('integrity-a', comps);
  const out: HigherOrderGuardViolation[] = [];
  out.push(...assertHigherOrderReadonly(comps));
  out.push(...assertHigherOrderDeterminism(a.transformation.signature, b.transformation.signature));
  out.push(...assertNoHigherOrderMutation(a, a));
  out.push(...assertNoHigherOrderCollapse(a.transformation));
  out.push(...assertNoHigherOrderCompositionFailure(a.composition));
  out.push(...assertNoHigherOrderIdentityBreak(a.identity));
  out.push(...assertNoHigherOrderDeterminismDegradation(a.determinism));
  out.push(...assertNoHigherOrderTopologyCollapse(a.topology));
  out.push(...assertNoHigherOrderStabilityCollapse(a.stability));
  out.push(...assertNoHigherOrderNaturalityBreak(a.naturality));
  out.push(...assertNoHigherOrderFunctorialityFailure(a.functoriality));
  out.push(...assertNoUnliftableTransformation(a.lifting));
  out.push(...assertHigherOrderCertificationIntegrity(a.certification));
  return Object.freeze(out);
}
