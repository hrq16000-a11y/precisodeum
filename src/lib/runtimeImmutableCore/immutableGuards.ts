/**
 * Fase 1.8.8 — Immutable guards (READ-ONLY).
 */

import type {
  ImmutableCertification,
  ImmutableEnvelope,
  ImmutableSeal,
  ImmutableViolationCode,
} from './immutableTypes';
import type { ImmutableTopologyAnalysis } from './immutableTopology';

export interface GuardViolation {
  readonly code: ImmutableViolationCode;
  readonly detail: string;
}

export function assertImmutableCoverage(
  envelopes: readonly ImmutableEnvelope[],
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (envelopes.length === 0) {
    out.push({ code: 'NON_DETERMINISTIC_IMMUTABLE_STATE', detail: 'no_envelopes' });
  }
  for (const e of envelopes) {
    if (e.seal.boundaries.length === 0) {
      out.push({ code: 'NON_DETERMINISTIC_IMMUTABLE_STATE', detail: `coverage_gap_${e.flow}` });
    }
  }
  return out;
}

export function assertImmutableReadOnlyInvariant(
  e: ImmutableEnvelope,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if ((e.liveExecutionEnabled as boolean)) {
    out.push({ code: 'IMMUTABLE_INVARIANT_BROKEN', detail: `live_${e.flow}` });
  }
  if ((e.retryEnabled as boolean)) {
    out.push({ code: 'IMMUTABLE_INVARIANT_BROKEN', detail: `retry_${e.flow}` });
  }
  if ((e.backgroundEnabled as boolean)) {
    out.push({ code: 'IMMUTABLE_INVARIANT_BROKEN', detail: `background_${e.flow}` });
  }
  if ((e.realUsersAllowed as boolean)) {
    out.push({ code: 'IMMUTABLE_INVARIANT_BROKEN', detail: `real_users_${e.flow}` });
  }
  if (e.currentStage !== 'STAGE_0_READ_ONLY') {
    out.push({ code: 'IMMUTABLE_INVARIANT_BROKEN', detail: `stage_${e.flow}` });
  }
  return out;
}

export function assertNoRuntimeUnlock(s: ImmutableSeal): readonly GuardViolation[] {
  return s.violations
    .filter(v => v.type === 'implicit_runtime_enablement' || v.type === 'recursive_runtime_unlock')
    .map(v => ({ code: 'RUNTIME_UNLOCK_DETECTED' as const, detail: `${v.flow}_${v.layer}` }));
}

export function assertNoCrossLayerEscape(s: ImmutableSeal): readonly GuardViolation[] {
  return s.violations
    .filter(v => v.type === 'cross_layer_side_effect' || v.type === 'drift_escape')
    .map(v => ({ code: 'CROSS_LAYER_ESCAPE_DETECTED' as const, detail: `${v.flow}_${v.layer}` }));
}

export function assertImmutableDeterminism(
  a: ImmutableEnvelope,
  b: ImmutableEnvelope,
): readonly GuardViolation[] {
  if (a.flow !== b.flow) return [];
  if (a.score !== b.score || a.seal.classification !== b.seal.classification) {
    return [{ code: 'NON_DETERMINISTIC_IMMUTABLE_STATE', detail: a.flow }];
  }
  return [];
}

export function assertImmutableTopologyIntegrity(
  t: ImmutableTopologyAnalysis,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (t.recursive) out.push({ code: 'IMMUTABLE_TOPOLOGY_UNSAFE', detail: `recursive_${t.flow}` });
  if (t.overlaps > 2) out.push({ code: 'IMMUTABLE_TOPOLOGY_UNSAFE', detail: `overlaps_${t.flow}` });
  return out;
}

export function assertImmutableCertificationIntegrity(
  c: ImmutableCertification,
): readonly GuardViolation[] {
  if (c.level === 'BLOCKED' && c.certified) {
    return [{ code: 'IMMUTABLE_CERTIFICATION_FAILED', detail: `cert_mismatch_${c.flow}` }];
  }
  return [];
}

export function assertImmutableSealIntegrity(
  s: ImmutableSeal,
): readonly GuardViolation[] {
  const out: GuardViolation[] = [];
  if (s.compromised && s.classification !== 'COMPROMISED') {
    out.push({ code: 'IMMUTABLE_SEAL_COMPROMISED', detail: `mismatch_${s.flow}` });
  }
  if (s.classification === 'COMPROMISED' && !s.compromised) {
    out.push({ code: 'IMMUTABLE_SEAL_COMPROMISED', detail: `flag_mismatch_${s.flow}` });
  }
  return out;
}
