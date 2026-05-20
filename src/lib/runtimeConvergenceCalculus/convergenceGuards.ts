/**
 * Fase 1.9.2 — Guards (READ-ONLY).
 */

import type {
  ConvergenceCertification,
  ConvergenceNode,
  ConvergenceSeverity,
  ConvergenceTopology,
  ConvergenceViolationCode,
  DivergenceTopology,
  MonotonicResolution,
  ResolutionFixedPoint,
  RuntimeConvergenceEnvelope,
  SaturationEnvelope,
  StabilityEnvelopeModel,
  TerminalResolutionState,
} from './convergenceTypes';

export interface ConvergenceGuardViolation {
  readonly code: ConvergenceViolationCode;
  readonly severity: ConvergenceSeverity;
  readonly message: string;
}

function v(
  code: ConvergenceViolationCode,
  severity: ConvergenceSeverity,
  message: string,
): ConvergenceGuardViolation {
  return Object.freeze({ code, severity, message });
}

export function assertConvergenceReadonly(
  nodes: readonly ConvergenceNode[],
): readonly ConvergenceGuardViolation[] {
  for (const n of nodes) {
    if (
      n.liveExecutionEnabled ||
      n.retryEnabled ||
      n.backgroundEnabled ||
      n.realUsersAllowed ||
      n.stage !== 'STAGE_0_READ_ONLY'
    ) {
      return [
        v(
          'CONVERGENCE_READONLY_INVARIANT_BROKEN',
          'critical',
          `read-only invariant broken at ${n.id}`,
        ),
      ];
    }
  }
  return [];
}

export function assertConvergenceDeterminism(
  a: RuntimeConvergenceEnvelope,
  b: RuntimeConvergenceEnvelope,
): readonly ConvergenceGuardViolation[] {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    return [
      v(
        'CONVERGENCE_NON_DETERMINISTIC',
        'critical',
        'envelopes diverged for identical inputs',
      ),
    ];
  }
  return [];
}

export function assertNoRuntimeMutation(
  before: readonly ConvergenceNode[],
  after: readonly ConvergenceNode[],
): readonly ConvergenceGuardViolation[] {
  if (before.length !== after.length) {
    return [v('CONVERGENCE_NON_DETERMINISTIC', 'critical', 'node count mutated')];
  }
  for (let i = 0; i < before.length; i += 1) {
    if (before[i].signature !== after[i].signature) {
      return [
        v(
          'CONVERGENCE_NON_DETERMINISTIC',
          'critical',
          `node ${before[i].id} mutated`,
        ),
      ];
    }
  }
  return [];
}

export function assertNoUnsafeConvergence(
  env: RuntimeConvergenceEnvelope,
): readonly ConvergenceGuardViolation[] {
  const out: ConvergenceGuardViolation[] = [];
  if (env.classification === 'DIVERGENT')
    out.push(v('CONVERGENCE_DIVERGENCE', 'critical', 'classification divergent'));
  if (env.classification === 'COLLAPSING')
    out.push(v('CONVERGENCE_COLLAPSE', 'critical', 'classification collapsing'));
  return out;
}

export function assertNoRecursiveCollapse(
  fps: readonly ResolutionFixedPoint[],
): readonly ConvergenceGuardViolation[] {
  for (const f of fps) {
    if (f.classification === 'COLLAPSING' && f.members.length >= 3) {
      return [
        v('CONVERGENCE_RECURSIVE_COLLAPSE', 'critical', `recursive collapse at ${f.id}`),
      ];
    }
  }
  return [];
}

export function assertNoTopologyFragmentation(
  t: ConvergenceTopology,
  d: DivergenceTopology,
): readonly ConvergenceGuardViolation[] {
  if (t.fragmented || d.fragmented) {
    return [
      v('CONVERGENCE_TOPOLOGY_FRAGMENTED', 'error', 'convergence topology fragmented'),
    ];
  }
  return [];
}

export function assertNoInfiniteResolution(
  t: TerminalResolutionState,
): readonly ConvergenceGuardViolation[] {
  if (t.infinite) {
    return [
      v(
        'CONVERGENCE_INFINITE_RESOLUTION',
        'critical',
        'infinite resolution detected',
      ),
    ];
  }
  return [];
}

export function assertConvergenceCertificationIntegrity(
  c: ConvergenceCertification,
): readonly ConvergenceGuardViolation[] {
  if (c.rank === 'BLOCKED') {
    return [
      v('CONVERGENCE_CERTIFICATION_INVALID', 'critical', 'certification blocked'),
    ];
  }
  return [];
}

export function assertSaturationGuard(
  s: SaturationEnvelope,
): readonly ConvergenceGuardViolation[] {
  if (s.level === 'CRITICAL') {
    return [
      v('CONVERGENCE_SATURATION_CRITICAL', 'critical', 'saturation critical'),
    ];
  }
  return [];
}

export function assertMonotonicityGuard(
  m: MonotonicResolution,
): readonly ConvergenceGuardViolation[] {
  if (m.classification === 'REVERSING' || m.classification === 'BROKEN') {
    return [
      v('CONVERGENCE_MONOTONICITY_BROKEN', 'error', `monotonicity ${m.classification}`),
    ];
  }
  return [];
}

export function assertTerminalGuard(
  t: TerminalResolutionState,
): readonly ConvergenceGuardViolation[] {
  if (t.failed) {
    return [
      v(
        'CONVERGENCE_TERMINAL_RESOLUTION_FAILED',
        'error',
        'terminal resolution failed',
      ),
    ];
  }
  return [];
}

export function assertStabilityGuard(
  s: StabilityEnvelopeModel,
): readonly ConvergenceGuardViolation[] {
  if (s.overflow) {
    return [
      v(
        'CONVERGENCE_FIXED_POINT_UNSTABLE',
        'critical',
        'stability envelope overflow',
      ),
    ];
  }
  if (s.recursiveInstability) {
    return [
      v(
        'CONVERGENCE_FIXED_POINT_UNSTABLE',
        'error',
        'recursive instability detected',
      ),
    ];
  }
  return [];
}
