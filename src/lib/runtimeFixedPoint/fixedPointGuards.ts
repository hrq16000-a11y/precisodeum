/**
 * Fase 1.9.1 — Guards (READ-ONLY).
 */

import type {
  FixedPointCertification,
  FixedPointConvergence,
  FixedPointEnvelope,
  FixedPointNormalization,
  FixedPointPropagation,
  FixedPointRecursion,
  FixedPointSeverity,
  FixedPointTopology,
  FixedPointViolationCode,
  RuntimeFixedPoint,
} from './fixedPointTypes';

export interface GuardViolation {
  readonly code: FixedPointViolationCode;
  readonly severity: FixedPointSeverity;
  readonly message: string;
}

function v(
  code: FixedPointViolationCode,
  severity: FixedPointSeverity,
  message: string,
): GuardViolation {
  return Object.freeze({ code, severity, message });
}

export function assertFixedPointIntegrity(
  fp: RuntimeFixedPoint,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (fp.class === 'divergent') {
    out.push(v('FIXED_POINT_DIVERGENCE', 'critical', `fp ${fp.id} divergent`));
  }
  if (fp.class === 'unstable') {
    out.push(v('FIXED_POINT_OSCILLATION', 'error', `fp ${fp.id} unstable`));
  }
  if (fp.class === 'impossible') {
    out.push(
      v('FIXED_POINT_CERTIFICATION_INVALID', 'critical', `fp ${fp.id} impossible`),
    );
  }
  return out;
}

export function assertConvergenceIntegrity(
  c: FixedPointConvergence,
): readonly GuardViolation[] {
  if (c.regressed || !c.asymptoticallyStable) {
    return [v('FIXED_POINT_DIVERGENCE', 'error', 'convergence regressed')];
  }
  return [];
}

export function assertPropagationIntegrity(
  p: FixedPointPropagation,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (p.overflow)
    out.push(v('FIXED_POINT_PROPAGATION_OVERFLOW', 'critical', 'propagation overflow'));
  if (p.infinite)
    out.push(v('FIXED_POINT_PROPAGATION_OVERFLOW', 'critical', 'propagation infinite'));
  return out;
}

export function assertRecursionContainment(
  r: FixedPointRecursion,
): readonly GuardViolation[] {
  if (!r.bounded || r.mode === 'unbounded') {
    return [v('FIXED_POINT_RECURSION_UNBOUNDED', 'error', 'recursion unbounded')];
  }
  return [];
}

export function assertNormalizationIntegrity(
  n: FixedPointNormalization,
): readonly GuardViolation[] {
  if (!n.idempotent || n.oscillating) {
    return [
      v('FIXED_POINT_NORMALIZATION_UNSTABLE', 'error', 'normalization unstable'),
    ];
  }
  return [];
}

export function assertTopologyIntegrity(
  t: FixedPointTopology,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (t.collapsed)
    out.push(v('FIXED_POINT_TOPOLOGY_COLLAPSED', 'critical', 'topology collapsed'));
  if (t.unreachable)
    out.push(v('FIXED_POINT_TOPOLOGY_COLLAPSED', 'error', 'equilibrium unreachable'));
  return out;
}

export function assertFixedPointReadOnlyInvariants(
  fp: RuntimeFixedPoint,
): readonly GuardViolation[] {
  for (const s of fp.states) {
    if (
      s.liveExecutionEnabled ||
      s.retryEnabled ||
      s.backgroundEnabled ||
      s.realUsersAllowed ||
      s.stage !== 'STAGE_0_READ_ONLY'
    ) {
      return [
        v(
          'FIXED_POINT_READONLY_INVARIANT_BROKEN',
          'critical',
          `read-only invariant broken at ${s.id}`,
        ),
      ];
    }
  }
  return [];
}

export function assertCertification(
  c: FixedPointCertification,
): readonly GuardViolation[] {
  if (c.rank === 'BLOCKED') {
    return [
      v('FIXED_POINT_CERTIFICATION_INVALID', 'critical', 'certification blocked'),
    ];
  }
  return [];
}

export function assertEnvelope(
  env: FixedPointEnvelope,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  for (const fp of env.resolution.fixedPoints) {
    out.push(...assertFixedPointIntegrity(fp));
    out.push(...assertFixedPointReadOnlyInvariants(fp));
  }
  out.push(...assertConvergenceIntegrity(env.convergence));
  out.push(...assertPropagationIntegrity(env.propagation));
  out.push(...assertRecursionContainment(env.recursion));
  out.push(...assertNormalizationIntegrity(env.normalization));
  out.push(...assertTopologyIntegrity(env.topology));
  out.push(...assertCertification(env.certification));
  return out;
}
