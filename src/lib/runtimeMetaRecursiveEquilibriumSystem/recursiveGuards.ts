/**
 * Fase 1.9.12 — Recursive guards (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqAggregate,
  ReqCertification,
  ReqContainment,
  ReqConvergenceModel,
  ReqDeterminism,
  ReqEnvelope,
  ReqInternals,
  ReqPropagation,
  ReqSeverity,
  ReqTopology,
  ReqViolation,
  ReqViolationCode,
} from './recursiveEquilibriumTypes';

function v(
  code: ReqViolationCode,
  target: string,
  severity: ReqSeverity,
  description: string,
): ReqViolation {
  return deepFreeze({ code, target, severity, description });
}

export function assertReadonlyInvariant(
  internals: ReqInternals,
  target: string,
): readonly ReqViolation[] {
  const out: ReqViolation[] = [];
  if (internals.stage !== 'STAGE_0_READ_ONLY')
    out.push(v('REQ_READONLY_INVARIANT_BROKEN', target, 'critical', 'stage_not_read_only'));
  if (
    internals.liveExecutionEnabled ||
    internals.retryEnabled ||
    internals.backgroundEnabled ||
    internals.realUsersAllowed
  )
    out.push(v('REQ_READONLY_INVARIANT_BROKEN', target, 'critical', 'flag_enabled'));
  return Object.freeze(out);
}

export function assertDeterministicInvariant(
  d: ReqDeterminism,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    d.stable ? [] : [v('REQ_DETERMINISM_BROKEN', target, 'critical', 'replay_unstable')],
  );
}

export function assertFreezeInvariant(
  value: unknown,
  target: string,
): readonly ReqViolation[] {
  if (value === null || typeof value !== 'object') return Object.freeze([]);
  return Object.freeze(
    Object.isFrozen(value)
      ? []
      : [v('REQ_FREEZE_BROKEN', target, 'error', 'not_frozen')],
  );
}

export function assertTopologyInvariant(
  t: ReqTopology,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    t.collapsed ? [v('REQ_TOPOLOGY_BROKEN', target, 'error', 'topology_collapsed')] : [],
  );
}

export function assertEquilibriumInvariant(
  c: ReqConvergenceModel,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    c.classification === 'DIVERGENT'
      ? [v('REQ_EQUILIBRIUM_BROKEN', target, 'error', 'divergent')]
      : [],
  );
}

export function assertContainmentInvariant(
  c: ReqContainment,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    c.classification === 'leaking' || c.classification === 'collapsing'
      ? [v('REQ_CONTAINMENT_BROKEN', target, 'error', c.classification)]
      : [],
  );
}

export function assertPropagationInvariant(
  p: ReqPropagation,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    p.overflow ? [v('REQ_PROPAGATION_OVERFLOW', target, 'error', 'overflow')] : [],
  );
}

export function assertCertificationInvariant(
  c: ReqCertification,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    c.rank === 'BLOCKED' || c.rank === 'UNSTABLE'
      ? [v('REQ_CERTIFICATION_INVALID', target, 'error', c.rank)]
      : [],
  );
}

export function assertAggregateInvariant(
  a: ReqAggregate,
  target: string,
): readonly ReqViolation[] {
  return Object.freeze(
    a.envelopes.length > 0 && !a.stable
      ? [v('REQ_AGGREGATE_INCONSISTENT', target, 'warn', 'aggregate_unstable')]
      : [],
  );
}

export function assertAllRecursiveIntegrity(
  envelopes: readonly ReqEnvelope[],
  internals: ReqInternals,
  aggregate: ReqAggregate,
): readonly ReqViolation[] {
  const out: ReqViolation[] = [];
  out.push(...assertReadonlyInvariant(internals, 'internals'));
  for (const e of envelopes) {
    out.push(...assertFreezeInvariant(e, e.id));
    out.push(...assertDeterministicInvariant(e.determinism, e.id));
    out.push(...assertTopologyInvariant(e.topology, e.id));
    out.push(...assertEquilibriumInvariant(e.convergence, e.id));
    out.push(...assertContainmentInvariant(e.containment, e.id));
    out.push(...assertPropagationInvariant(e.propagation, e.id));
    out.push(...assertCertificationInvariant(e.certification, e.id));
    if (!e.closure.closed)
      out.push(v('REQ_CLOSURE_OPEN', e.id, 'warn', 'closure_open'));
  }
  out.push(...assertAggregateInvariant(aggregate, aggregate.signature));
  return Object.freeze(
    [...out].sort(
      (a, b) =>
        a.code.localeCompare(b.code) ||
        a.target.localeCompare(b.target) ||
        a.severity.localeCompare(b.severity),
    ),
  );
}
