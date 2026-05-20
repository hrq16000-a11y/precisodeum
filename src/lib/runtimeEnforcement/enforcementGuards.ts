/**
 * Fase 1.8.7 — Enforcement guards (READ-ONLY).
 */

import type {
  EnforcementCertification,
  EnforcementEnvelope,
  EnforcementViolationCode,
  RuntimeEnforcement,
} from './enforcementTypes';
import type { TopologyAnalysis } from './topologyEnforcement';
import type { DependencyAnalysis } from './dependencyEnforcement';

export interface GuardViolation {
  readonly code: EnforcementViolationCode;
  readonly detail: string;
}

export function assertEnforcementCoverage(
  envelopes: readonly EnforcementEnvelope[],
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (envelopes.length === 0) {
    out.push({ code: 'NON_DETERMINISTIC_ENFORCEMENT', detail: 'no_envelopes' });
  }
  for (const e of envelopes) {
    if (e.enforcement.boundaries.length === 0) {
      out.push({ code: 'NON_DETERMINISTIC_ENFORCEMENT', detail: `coverage_gap_${e.flow}` });
    }
  }
  return out;
}

export function assertNoBoundaryEscape(
  e: RuntimeEnforcement,
): readonly GuardViolation[] {
  return e.violations
    .filter(v => v.type === 'boundary_escape' || v.type === 'runtime_activation')
    .map(v => ({ code: 'BOUNDARY_ESCAPE_DETECTED' as const, detail: `${v.flow}_${v.layer}` }));
}

export function assertNoImplicitMutation(
  e: RuntimeEnforcement,
): readonly GuardViolation[] {
  return e.violations
    .filter(v => v.type === 'implicit_mutation' || v.type === 'cross_layer_mutation')
    .map(v => ({ code: 'IMPLICIT_MUTATION_DETECTED' as const, detail: `${v.flow}_${v.layer}` }));
}

export function assertNoUnsafeRuntimeActivation(
  envelope: EnforcementEnvelope,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (envelope.liveExecutionEnabled as boolean) {
    out.push({ code: 'LIVE_RUNTIME_ACTIVATED', detail: envelope.flow });
  }
  if (envelope.retryEnabled as boolean) {
    out.push({ code: 'RETRY_RUNTIME_ENABLED', detail: envelope.flow });
  }
  if (envelope.backgroundEnabled as boolean) {
    out.push({ code: 'BACKGROUND_RUNTIME_ENABLED', detail: envelope.flow });
  }
  return out;
}

export function assertEnforcementDeterminism(
  a: EnforcementEnvelope,
  b: EnforcementEnvelope,
): readonly GuardViolation[] {
  if (a.flow !== b.flow) return [];
  const out: GuardViolation[] = [];
  if (a.score !== b.score || a.enforcement.classification !== b.enforcement.classification) {
    out.push({ code: 'NON_DETERMINISTIC_ENFORCEMENT', detail: a.flow });
  }
  return out;
}

export function assertRuntimeLockdownInvariant(
  e: RuntimeEnforcement,
): readonly GuardViolation[] {
  if (e.lockdown === 'collapsed' && e.classification !== 'BLOCKED') {
    return [{ code: 'LIVE_RUNTIME_ACTIVATED', detail: `lockdown_mismatch_${e.flow}` }];
  }
  return [];
}

export function assertEnforcementTopologyIntegrity(
  t: TopologyAnalysis,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (t.recursive) out.push({ code: 'RECURSIVE_RUNTIME_DEPENDENCY', detail: t.flow });
  if (t.overlaps > 2) out.push({ code: 'UNSAFE_TOPOLOGY_RUNTIME', detail: t.flow });
  return out;
}

export function assertEnforcementCertificationIntegrity(
  c: EnforcementCertification,
): readonly GuardViolation[] {
  if (c.level === 'BLOCKED' && c.certified) {
    return [{ code: 'NON_DETERMINISTIC_ENFORCEMENT', detail: `cert_mismatch_${c.flow}` }];
  }
  return [];
}

export function assertNoRecursiveDependency(
  a: DependencyAnalysis,
): readonly GuardViolation[] {
  if (!a.recursive) return [];
  return [{ code: 'RECURSIVE_RUNTIME_DEPENDENCY', detail: a.flow }];
}
