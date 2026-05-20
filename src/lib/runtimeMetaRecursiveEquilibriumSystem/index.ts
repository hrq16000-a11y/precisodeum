/**
 * Fase 1.9.12 — Public barrel + envelope builder (READ-ONLY).
 */

import { aggregateRecursiveEnvelopes } from './aggregation';
import { buildRecursiveCertification } from './recursiveCertification';
import { buildRecursiveClosure } from './recursiveClosure';
import { checkRecursiveComposition } from './recursiveComposition';
import { buildRecursiveContainment } from './recursiveContainment';
import { buildRecursiveConvergenceModel } from './recursiveConvergence';
import { buildRecursiveDeterminism } from './recursiveDeterminism';
import { buildRecursiveEquivalence } from './recursiveEquivalence';
import { checkRecursiveIdentity } from './recursiveIdentity';
import { buildRecursiveNormalization } from './recursiveNormalization';
import { buildRecursivePropagation } from './recursivePropagation';
import { buildRecursiveReduction } from './recursiveReduction';
import { buildRecursiveStability } from './recursiveStability';
import { buildRecursiveTopology } from './recursiveTopology';
import { REQ_INTERNALS } from './recursiveAdapters';
import {
  deepFreeze,
  reqSignature,
  resolveRecursiveEquilibrium,
} from './recursiveEquilibrium';
import type { ReqEnvelope, ReqSystem } from './recursiveEquilibriumTypes';

export * from './recursiveEquilibriumTypes';
export * from './recursiveEquilibrium';
export * from './recursiveComposition';
export * from './recursiveIdentity';
export * from './recursiveNormalization';
export * from './recursiveDeterminism';
export * from './recursiveEquivalence';
export * from './recursiveReduction';
export * from './recursiveTopology';
export * from './recursiveStability';
export * from './recursiveCertification';
export * from './recursiveContainment';
export * from './recursivePropagation';
export * from './recursiveClosure';
export * from './recursiveConvergence';
export * from './aggregation';
export * from './recursiveAdapters';
export * from './recursiveObservability';
export * from './explainers';
export * from './recursiveGuards';

export function buildRecursiveEnvelope(sys: ReqSystem): ReqEnvelope {
  const resolution = resolveRecursiveEquilibrium(sys);
  const composition = checkRecursiveComposition(sys);
  const identity = checkRecursiveIdentity(sys);
  const normalization = buildRecursiveNormalization(sys);
  const determinism = buildRecursiveDeterminism(sys);
  const equivalence = buildRecursiveEquivalence(resolution);
  const reduction = buildRecursiveReduction(resolution);
  const topology = buildRecursiveTopology(sys, resolution);
  const stability = buildRecursiveStability(resolution);
  const certification = buildRecursiveCertification(
    resolution, identity, composition, normalization, determinism, topology, stability,
  );
  const containment = buildRecursiveContainment(resolution);
  const propagation = buildRecursivePropagation(resolution);
  const closure = buildRecursiveClosure(sys, resolution);
  const convergence = buildRecursiveConvergenceModel(resolution);
  const signature = reqSignature({
    sysSig: sys.signature,
    normSig: normalization.signature,
    detSig: determinism.signature,
    redSig: reduction.signature,
    closureSig: closure.signature,
    certRank: certification.rank,
    convCls: convergence.classification,
  });
  return deepFreeze({
    id: sys.id,
    system: sys,
    resolution,
    composition,
    identity,
    normalization,
    determinism,
    equivalence,
    reduction,
    topology,
    stability,
    certification,
    containment,
    propagation,
    closure,
    convergence,
    signature,
  });
}

export function buildRecursiveAggregate(systems: readonly ReqSystem[]) {
  const envs = systems.map(buildRecursiveEnvelope);
  return aggregateRecursiveEnvelopes(envs, []);
}

export const __runtime_meta_recursive_equilibrium_system_internals = REQ_INTERNALS;
