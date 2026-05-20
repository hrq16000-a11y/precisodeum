/**
 * Fase 1.9.1 — Deterministic explainers (READ-ONLY).
 */

import type {
  FixedPointCertification,
  FixedPointConvergence,
  FixedPointEnvelope,
  FixedPointNormalization,
  FixedPointPropagation,
  FixedPointRecursion,
  FixedPointTopology,
  RuntimeFixedPoint,
} from './fixedPointTypes';

export function explainFixedPoint(fp: RuntimeFixedPoint): string {
  return `fixed-point ${fp.id} class=${fp.class} iterations=${fp.iterations} stable=${fp.stable}`;
}

export function explainConvergence(c: FixedPointConvergence): string {
  return `convergence mode=${c.mode} confidence=${c.confidence.toFixed(3)} regressed=${c.regressed} asymptotic=${c.asymptoticallyStable}`;
}

export function explainPropagation(p: FixedPointPropagation): string {
  return `propagation mode=${p.mode} bounded=${p.bounded} overflow=${p.overflow} infinite=${p.infinite}`;
}

export function explainRecursion(r: FixedPointRecursion): string {
  return `recursion mode=${r.mode} depth=${r.depth} bounded=${r.bounded}`;
}

export function explainNormalization(n: FixedPointNormalization): string {
  return `normalization mode=${n.mode} idempotent=${n.idempotent} oscillating=${n.oscillating}`;
}

export function explainTopology(t: FixedPointTopology): string {
  return `topology mode=${t.mode} oscillating=${t.oscillating} recursive=${t.recursive} collapsed=${t.collapsed} unreachable=${t.unreachable}`;
}

export function explainFixedPointCertification(c: FixedPointCertification): string {
  return `certification rank=${c.rank} confidence=${c.confidence.toFixed(3)} reasons=${c.reasons.join(',') || 'none'}`;
}

export function explainFixedPointIntegrity(env: FixedPointEnvelope): string {
  return [
    `envelope=${env.id}`,
    explainConvergence(env.convergence),
    explainTopology(env.topology),
    explainPropagation(env.propagation),
    explainRecursion(env.recursion),
    explainNormalization(env.normalization),
    explainFixedPointCertification(env.certification),
    `health.score=${env.health.score.toFixed(3)} stable=${env.health.stable}`,
  ].join(' | ');
}
