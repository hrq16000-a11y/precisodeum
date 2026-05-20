export * from './functorTypes';
export * from './equilibriumFunctor';
export * from './functorComposition';
export * from './functorIdentity';
export * from './functorNormalization';
export * from './functorDeterminism';
export * from './functorEquivalence';
export * from './functorReduction';
export * from './functorTopology';
export * from './functorStability';
export * from './functorCertification';
export * from './aggregation';
export * from './functorAdapters';
export * from './functorObservability';
export * from './explainers';
export * from './functorGuards';

import { buildEquilibriumFunctor } from './equilibriumFunctor';
import { buildFunctorComposition } from './functorComposition';
import { buildFunctorIdentity } from './functorIdentity';
import { buildFunctorNormalization } from './functorNormalization';
import { buildFunctorDeterminism } from './functorDeterminism';
import { buildFunctorEquivalence } from './functorEquivalence';
import { buildFunctorReduction } from './functorReduction';
import { buildFunctorTopology } from './functorTopology';
import { buildFunctorStability } from './functorStability';
import { assertFunctorSafety, certifyFunctorStability } from './functorCertification';
import type { FunctorObject, RuntimeFunctorEnvelope } from './functorTypes';

export function buildFunctorEnvelope(id: string, objects: readonly FunctorObject[]): RuntimeFunctorEnvelope {
  const functor = buildEquilibriumFunctor(objects);
  const composition = buildFunctorComposition(functor.objects);
  const identity = buildFunctorIdentity(functor.objects);
  const normalization = buildFunctorNormalization(functor.objects);
  const determinism = buildFunctorDeterminism(functor.objects);
  const equivalence = buildFunctorEquivalence(functor.objects);
  const reduction = buildFunctorReduction(functor.objects);
  const topology = buildFunctorTopology(functor.objects);
  const stability = buildFunctorStability(composition, identity, normalization, topology);
  const certification = certifyFunctorStability({ objects: functor.objects, functor, composition, identity, normalization, determinism, equivalence, topology, stability });
  const risks = assertFunctorSafety(certification);
  const score = (functor.preservation + composition.associativity + identity.preservation + normalization.stability + determinism.score + equivalence.strength + reduction.score + topology.connectivity + stability.score) / 9;
  const stable = !functor.collapsed && !composition.broken && !identity.broken && !normalization.divergent && !determinism.degraded && !equivalence.fractured && !topology.collapsed && !stability.collapsed && certification.safe;
  return Object.freeze({ id, functor, composition, identity, normalization, determinism, equivalence, reduction, topology, stability, certification, risks, score, stable });
}

import { buildDefaultFunctorInputs } from './functorAdapters';
import { assertFunctorCertificationIntegrity, assertFunctorDeterminism, assertFunctorReadonly, assertNoCompositionFailure, assertNoDeterminismDegradation, assertNoFunctorCollapse, assertNoFunctorMutation, assertNoIdentityBreak, assertNoStabilityCollapse, assertNoTopologyCollapse, type FunctorGuardViolation } from './functorGuards';

export function assertAllFunctorIntegrity(): readonly FunctorGuardViolation[] {
  const objs = buildDefaultFunctorInputs();
  const a = buildFunctorEnvelope('integrity-a', objs);
  const b = buildFunctorEnvelope('integrity-a', objs);
  const out: FunctorGuardViolation[] = [];
  out.push(...assertFunctorReadonly(objs));
  out.push(...assertFunctorDeterminism(a.functor.signature, b.functor.signature));
  out.push(...assertNoFunctorMutation(a, a));
  out.push(...assertNoFunctorCollapse(a.functor));
  out.push(...assertNoCompositionFailure(a.composition));
  out.push(...assertNoIdentityBreak(a.identity));
  out.push(...assertNoDeterminismDegradation(a.determinism));
  out.push(...assertNoTopologyCollapse(a.topology));
  out.push(...assertNoStabilityCollapse(a.stability));
  out.push(...assertFunctorCertificationIntegrity(a.certification));
  return Object.freeze(out);
}
