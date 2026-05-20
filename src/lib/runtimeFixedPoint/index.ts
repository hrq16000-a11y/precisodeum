/**
 * Fase 1.9.1 — Runtime Fixed-Point public API (READ-ONLY).
 */

import { aggregateEquivalenceHealth } from './fixedPointEquivalence';
import { buildConvergenceModel } from './fixedPointConvergence';
import { buildFixedPointTopology } from './fixedPointTopology';
import { buildPropagationResolution } from './fixedPointPropagation';
import { certifyFixedPointIntegrity } from './fixedPointCertification';
import { classifyNormalizationStability } from './fixedPointNormalization';
import {
  aggregateResolutionHealth,
  resolveFixedPoints,
} from './fixedPointResolution';
import type {
  FixedPointEnvelope,
  FixedPointHealth,
  FixedPointRecursion,
  FixedPointRisk,
  FixedPointState,
} from './fixedPointTypes';

export * from './fixedPointTypes';
export * from './fixedPointResolution';
export * from './fixedPointConvergence';
export * from './fixedPointTopology';
export * from './fixedPointEquivalence';
export * from './fixedPointPropagation';
export * from './fixedPointNormalization';
export * from './fixedPointCertification';
export * from './aggregation';
export * from './fixedPointAdapters';
export * from './fixedPointObservability';
export * from './explainers';
export * from './fixedPointGuards';
export * from './assertFixedPointIntegrity';

function buildRecursion(resolution: ReturnType<typeof resolveFixedPoints>): FixedPointRecursion {
  const depth = resolution.fixedPoints.reduce(
    (acc, f) => Math.max(acc, f.iterations),
    0,
  );
  const bounded = resolution.loops.length === 0 && depth <= 32;
  let mode: FixedPointRecursion['mode'];
  if (!bounded && depth > 32) mode = 'unbounded';
  else if (resolution.impossible.length > 0) mode = 'collapsed';
  else if (resolution.loops.length > 0) mode = 'equivalent';
  else mode = 'bounded';
  return Object.freeze({ mode, depth, bounded });
}

function buildHealth(
  env: Omit<FixedPointEnvelope, 'health'>,
): FixedPointHealth {
  const risks: FixedPointRisk[] = [];
  if (env.convergence.regressed)
    risks.push(Object.freeze({
      code: 'FIXED_POINT_DIVERGENCE',
      severity: 'error',
      description: 'convergence regressed',
    }));
  if (env.topology.collapsed)
    risks.push(Object.freeze({
      code: 'FIXED_POINT_TOPOLOGY_COLLAPSED',
      severity: 'critical',
      description: 'topology collapsed',
    }));
  if (env.propagation.overflow || env.propagation.infinite)
    risks.push(Object.freeze({
      code: 'FIXED_POINT_PROPAGATION_OVERFLOW',
      severity: 'critical',
      description: 'propagation overflow',
    }));
  if (!env.recursion.bounded)
    risks.push(Object.freeze({
      code: 'FIXED_POINT_RECURSION_UNBOUNDED',
      severity: 'error',
      description: 'recursion unbounded',
    }));
  if (env.normalization.oscillating)
    risks.push(Object.freeze({
      code: 'FIXED_POINT_NORMALIZATION_UNSTABLE',
      severity: 'warn',
      description: 'normalization oscillating',
    }));
  if (env.certification.rank === 'BLOCKED')
    risks.push(Object.freeze({
      code: 'FIXED_POINT_CERTIFICATION_INVALID',
      severity: 'critical',
      description: 'certification blocked',
    }));

  const score = env.certification.confidence;
  const stable = risks.every((r) => r.severity !== 'critical') && score >= 0.5;
  return Object.freeze({ score, stable, risks: Object.freeze(risks) });
}

export function buildFixedPointEnvelope(
  id: string,
  states: readonly FixedPointState[],
): FixedPointEnvelope {
  const resolution = resolveFixedPoints(states);
  const convergence = buildConvergenceModel(resolution);
  const topology = buildFixedPointTopology(resolution);
  const equivalence = aggregateEquivalenceHealth(resolution);
  const propagation = buildPropagationResolution(resolution);
  const recursion = buildRecursion(resolution);
  const normalization = classifyNormalizationStability(resolution);
  const certification = certifyFixedPointIntegrity({
    resolution,
    convergence,
    topology,
    propagation,
    recursion,
    normalization,
  });
  aggregateResolutionHealth(resolution); // pure call, no side-effects
  const partial = {
    id,
    resolution,
    convergence,
    topology,
    equivalence,
    recursion,
    propagation,
    normalization,
    certification,
  } as Omit<FixedPointEnvelope, 'health'>;
  const health = buildHealth(partial);
  return Object.freeze({ ...partial, health });
}
