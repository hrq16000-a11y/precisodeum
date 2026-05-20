/**
 * Fase 1.9.11 — Public barrel + envelope builder (READ-ONLY).
 */

import { aggregateEnvelopes } from './aggregation';
import { buildClosure } from './fixedPointClosure';
import { checkComposition } from './fixedPointComposition';
import { buildCertification } from './fixedPointCertification';
import { buildConvergenceModel } from './convergenceCategory';
import { buildContainment } from './recursiveContainment';
import { buildDeterminism } from './fixedPointDeterminism';
import { buildEquivalence } from './fixedPointEquivalence';
import { buildNormalization } from './fixedPointNormalization';
import { buildReduction } from './fixedPointReduction';
import { buildStability } from './fixedPointStability';
import { buildTopology } from './fixedPointTopology';
import { checkIdentity } from './fixedPointIdentity';
import { FPC_INTERNALS } from './fixedPointAdapters';
import {
  deepFreeze,
  fpcSignature,
  resolveFixedPointCategory,
} from './fixedPointCategory';
import type { FpcCategory, FpcEnvelope } from './fixedPointCategoryTypes';

export * from './fixedPointCategoryTypes';
export * from './fixedPointCategory';
export * from './fixedPointComposition';
export * from './fixedPointIdentity';
export * from './fixedPointNormalization';
export * from './fixedPointDeterminism';
export * from './fixedPointEquivalence';
export * from './fixedPointReduction';
export * from './fixedPointTopology';
export * from './fixedPointStability';
export * from './fixedPointCertification';
export * from './fixedPointClosure';
export * from './recursiveContainment';
export * from './convergenceCategory';
export * from './aggregation';
export * from './fixedPointAdapters';
export * from './fixedPointObservability';
export * from './explainers';
export * from './fixedPointGuards';

export function buildFixedPointEnvelope(cat: FpcCategory): FpcEnvelope {
  const resolution = resolveFixedPointCategory(cat);
  const identity = checkIdentity(cat);
  const composition = checkComposition(cat);
  const normalization = buildNormalization(cat);
  const determinism = buildDeterminism(cat);
  const equivalence = buildEquivalence(resolution);
  const reduction = buildReduction(resolution);
  const topology = buildTopology(cat, resolution);
  const stability = buildStability(resolution);
  const certification = buildCertification(
    resolution,
    identity,
    composition,
    normalization,
    determinism,
    topology,
    stability,
  );
  const closure = buildClosure(cat, resolution);
  const containment = buildContainment(resolution);
  const convergence = buildConvergenceModel(resolution);
  const signature = fpcSignature({
    catSig: cat.signature,
    normSig: normalization.signature,
    detSig: determinism.signature,
    redSig: reduction.signature,
    closureSig: closure.signature,
    certRank: certification.rank,
    convCls: convergence.classification,
  });
  return deepFreeze({
    id: cat.id,
    category: cat,
    resolution,
    identity,
    composition,
    normalization,
    determinism,
    equivalence,
    reduction,
    topology,
    stability,
    certification,
    closure,
    containment,
    convergence,
    signature,
  });
}

export function buildFixedPointAggregate(cats: readonly FpcCategory[]) {
  const envs = cats.map(buildFixedPointEnvelope);
  return aggregateEnvelopes(envs, []);
}

export const __runtime_meta_fixed_point_category_internals = FPC_INTERNALS;
