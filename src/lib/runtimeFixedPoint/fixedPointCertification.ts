/**
 * Fase 1.9.1 — Fixed-Point certification (READ-ONLY).
 */

import type {
  FixedPointCertification,
  FixedPointConvergence,
  FixedPointNormalization,
  FixedPointPropagation,
  FixedPointRecursion,
  FixedPointResolution,
  FixedPointTopology,
} from './fixedPointTypes';

interface CertifyInput {
  readonly resolution: FixedPointResolution;
  readonly convergence: FixedPointConvergence;
  readonly topology: FixedPointTopology;
  readonly propagation: FixedPointPropagation;
  readonly recursion: FixedPointRecursion;
  readonly normalization: FixedPointNormalization;
}

export function certifyFixedPointIntegrity(
  input: CertifyInput,
): FixedPointCertification {
  const reasons: string[] = [];
  let confidence = 1;

  if (!certifyConvergence(input.convergence)) {
    reasons.push('convergence_regressed');
    confidence -= 0.3;
  }
  if (!certifyPropagation(input.propagation)) {
    reasons.push('propagation_unstable');
    confidence -= 0.25;
  }
  if (!certifyRecursionContainment(input.recursion)) {
    reasons.push('recursion_unbounded');
    confidence -= 0.25;
  }
  if (!certifyNormalization(input.normalization)) {
    reasons.push('normalization_unstable');
    confidence -= 0.2;
  }
  if (!certifyTopologyStability(input.topology)) {
    reasons.push('topology_unstable');
    confidence -= 0.25;
  }

  // Hard invariants: any unsafe state => BLOCKED
  const unsafe =
    input.resolution.fixedPoints.some(
      (f) =>
        f.states.some(
          (s) =>
            s.liveExecutionEnabled ||
            s.retryEnabled ||
            s.backgroundEnabled ||
            s.realUsersAllowed ||
            s.stage !== 'STAGE_0_READ_ONLY',
        ),
    );
  if (unsafe) {
    return Object.freeze({
      rank: 'BLOCKED',
      confidence: 0,
      reasons: Object.freeze([...reasons, 'readonly_invariant_broken']),
    });
  }

  confidence = Math.max(0, Math.min(1, confidence));
  let rank: FixedPointCertification['rank'];
  if (reasons.length === 0 && confidence >= 0.95) rank = 'FULL';
  else if (confidence >= 0.7) rank = 'PARTIAL';
  else if (confidence >= 0.4) rank = 'CONDITIONAL';
  else rank = 'BLOCKED';

  return Object.freeze({ rank, confidence, reasons: Object.freeze(reasons) });
}

export function certifyConvergence(c: FixedPointConvergence): boolean {
  return !c.regressed && c.asymptoticallyStable && c.confidence >= 0.5;
}

export function certifyPropagation(p: FixedPointPropagation): boolean {
  return p.bounded && !p.overflow && !p.infinite;
}

export function certifyRecursionContainment(r: FixedPointRecursion): boolean {
  return r.bounded && r.mode !== 'unbounded' && r.mode !== 'collapsed';
}

export function certifyNormalization(n: FixedPointNormalization): boolean {
  return n.idempotent && !n.oscillating;
}

export function certifyTopologyStability(t: FixedPointTopology): boolean {
  return !t.collapsed && !t.unreachable && !t.oscillating;
}
