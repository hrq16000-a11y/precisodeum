export * from './naturalTransformationTypes';
export * from './naturalTransformation';
export * from './naturalComposition';
export * from './naturalIdentity';
export * from './naturalNormalization';
export * from './naturalDeterminism';
export * from './naturalEquivalence';
export * from './naturalReduction';
export * from './naturalTopology';
export * from './naturalStability';
export * from './naturalCertification';
export * from './naturalityConditions';
export * from './commutativeDiagrams';
export * from './aggregation';
export * from './naturalAdapters';
export * from './naturalObservability';
export * from './explainers';
export * from './naturalGuards';

import { buildNaturalTransformation } from './naturalTransformation';
import { buildNaturalComposition } from './naturalComposition';
import { buildNaturalIdentity } from './naturalIdentity';
import { buildNaturalNormalization } from './naturalNormalization';
import { buildNaturalDeterminism } from './naturalDeterminism';
import { buildNaturalEquivalence } from './naturalEquivalence';
import { buildNaturalReduction } from './naturalReduction';
import { buildNaturalTopology } from './naturalTopology';
import { buildNaturalStability } from './naturalStability';
import { buildCommutativeDiagram } from './commutativeDiagrams';
import { buildNaturalityConditions } from './naturalityConditions';
import { assertNaturalSafety, certifyNaturalStability } from './naturalCertification';
import type { NaturalComponent, RuntimeNaturalEnvelope } from './naturalTransformationTypes';

export function buildNaturalEnvelope(id: string, components: readonly NaturalComponent[]): RuntimeNaturalEnvelope {
  const transformation = buildNaturalTransformation(components);
  const composition = buildNaturalComposition(transformation.components);
  const identity = buildNaturalIdentity(transformation.components);
  const normalization = buildNaturalNormalization(transformation.components);
  const determinism = buildNaturalDeterminism(transformation.components);
  const equivalence = buildNaturalEquivalence(transformation.components);
  const reduction = buildNaturalReduction(transformation.components);
  const topology = buildNaturalTopology(transformation.components);
  const stability = buildNaturalStability(composition, identity, normalization, topology);
  const diagram = buildCommutativeDiagram(transformation.components);
  const naturalityConditions = buildNaturalityConditions(transformation.components);
  const certification = certifyNaturalStability({ components: transformation.components, transformation, composition, identity, normalization, determinism, equivalence, topology, stability, diagram, naturalityConditions });
  const risks = assertNaturalSafety(certification);
  const score = (transformation.naturality + composition.associativity + identity.preservation + normalization.stability + determinism.score + equivalence.strength + reduction.score + topology.connectivity + stability.score + diagram.commutativity + naturalityConditions.score) / 11;
  const stable = !transformation.collapsed && !composition.broken && !identity.broken && !normalization.divergent && !determinism.degraded && !equivalence.fractured && !topology.collapsed && !stability.collapsed && !diagram.failed && naturalityConditions.satisfied && certification.safe;
  return Object.freeze({ id, transformation, composition, identity, normalization, determinism, equivalence, reduction, topology, stability, diagram, naturalityConditions, certification, risks, score, stable });
}

import { buildDefaultNaturalInputs } from './naturalAdapters';
import { assertNaturalCertificationIntegrity, assertNaturalDeterminism, assertNaturalReadonly, assertNaturalityConditions, assertNoCompositionFailure, assertNoDeterminismDegradation, assertNoDiagramFailure, assertNoIdentityBreak, assertNoNaturalMutation, assertNoStabilityCollapse, assertNoTopologyCollapse, assertNoTransformationCollapse, type NaturalGuardViolation } from './naturalGuards';

export function assertAllNaturalTransformationIntegrity(): readonly NaturalGuardViolation[] {
  const comps = buildDefaultNaturalInputs();
  const a = buildNaturalEnvelope('integrity-a', comps);
  const b = buildNaturalEnvelope('integrity-a', comps);
  const out: NaturalGuardViolation[] = [];
  out.push(...assertNaturalReadonly(comps));
  out.push(...assertNaturalDeterminism(a.transformation.signature, b.transformation.signature));
  out.push(...assertNoNaturalMutation(a, a));
  out.push(...assertNoTransformationCollapse(a.transformation));
  out.push(...assertNoCompositionFailure(a.composition));
  out.push(...assertNoIdentityBreak(a.identity));
  out.push(...assertNoDeterminismDegradation(a.determinism));
  out.push(...assertNoTopologyCollapse(a.topology));
  out.push(...assertNoStabilityCollapse(a.stability));
  out.push(...assertNoDiagramFailure(a.diagram));
  out.push(...assertNaturalityConditions(a.naturalityConditions));
  out.push(...assertNaturalCertificationIntegrity(a.certification));
  return Object.freeze(out);
}
