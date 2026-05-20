/**
 * Fase 1.9.11 — Guards (READ-ONLY, deterministic violations).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcAggregate,
  FpcCertification,
  FpcContainment,
  FpcConvergenceModel,
  FpcDeterminism,
  FpcEnvelope,
  FpcInternals,
  FpcSeverity,
  FpcTopology,
  FpcViolation,
  FpcViolationCode,
} from './fixedPointCategoryTypes';

function v(
  code: FpcViolationCode,
  target: string,
  severity: FpcSeverity,
  description: string,
): FpcViolation {
  return deepFreeze({ code, target, severity, description });
}

export function assertFixedPointReadonlyInvariant(
  internals: FpcInternals,
  target: string,
): readonly FpcViolation[] {
  const out: FpcViolation[] = [];
  if (internals.stage !== 'STAGE_0_READ_ONLY')
    out.push(v('FPC_READONLY_INVARIANT_BROKEN', target, 'critical', 'stage_not_read_only'));
  if (internals.liveExecutionEnabled || internals.retryEnabled || internals.backgroundEnabled || internals.realUsersAllowed)
    out.push(v('FPC_READONLY_INVARIANT_BROKEN', target, 'critical', 'flag_enabled'));
  return Object.freeze(out);
}

export function assertFixedPointDeterministicInvariant(
  d: FpcDeterminism,
  target: string,
): readonly FpcViolation[] {
  return Object.freeze(
    d.stable ? [] : [v('FPC_DETERMINISM_BROKEN', target, 'critical', 'replay_unstable')],
  );
}

export function assertFixedPointFreezeInvariant(
  value: unknown,
  target: string,
): readonly FpcViolation[] {
  if (value === null || typeof value !== 'object') return Object.freeze([]);
  return Object.freeze(
    Object.isFrozen(value)
      ? []
      : [v('FPC_FREEZE_BROKEN', target, 'error', 'not_frozen')],
  );
}

export function assertFixedPointTopologyInvariant(
  t: FpcTopology,
  target: string,
): readonly FpcViolation[] {
  return Object.freeze(
    t.collapsed ? [v('FPC_TOPOLOGY_BROKEN', target, 'error', 'topology_collapsed')] : [],
  );
}

export function assertFixedPointConvergenceInvariant(
  c: FpcConvergenceModel,
  target: string,
): readonly FpcViolation[] {
  return Object.freeze(
    c.classification === 'DIVERGENT'
      ? [v('FPC_CONVERGENCE_BROKEN', target, 'error', 'divergent')]
      : [],
  );
}

export function assertFixedPointContainmentInvariant(
  c: FpcContainment,
  target: string,
): readonly FpcViolation[] {
  return Object.freeze(
    c.classification === 'leaking' || c.classification === 'collapsing'
      ? [v('FPC_CONTAINMENT_BROKEN', target, 'error', c.classification)]
      : [],
  );
}

export function assertFixedPointCertificationInvariant(
  c: FpcCertification,
  target: string,
): readonly FpcViolation[] {
  return Object.freeze(
    c.rank === 'BLOCKED' || c.rank === 'UNSTABLE'
      ? [v('FPC_CERTIFICATION_INVALID', target, 'error', c.rank)]
      : [],
  );
}

export function assertFixedPointAggregateInvariant(
  a: FpcAggregate,
  target: string,
): readonly FpcViolation[] {
  return Object.freeze(
    a.envelopes.length > 0 && !a.stable
      ? [v('FPC_AGGREGATE_INCONSISTENT', target, 'warn', 'aggregate_unstable')]
      : [],
  );
}

export function assertAllFixedPointIntegrity(
  envelopes: readonly FpcEnvelope[],
  internals: FpcInternals,
  aggregate: FpcAggregate,
): readonly FpcViolation[] {
  const out: FpcViolation[] = [];
  out.push(...assertFixedPointReadonlyInvariant(internals, 'internals'));
  for (const e of envelopes) {
    out.push(...assertFixedPointFreezeInvariant(e, e.id));
    out.push(...assertFixedPointDeterministicInvariant(e.determinism, e.id));
    out.push(...assertFixedPointTopologyInvariant(e.topology, e.id));
    out.push(...assertFixedPointConvergenceInvariant(e.convergence, e.id));
    out.push(...assertFixedPointContainmentInvariant(e.containment, e.id));
    out.push(...assertFixedPointCertificationInvariant(e.certification, e.id));
  }
  out.push(...assertFixedPointAggregateInvariant(aggregate, aggregate.signature));
  const sorted = [...out].sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      a.target.localeCompare(b.target) ||
      a.severity.localeCompare(b.severity),
  );
  return Object.freeze(sorted);
}
