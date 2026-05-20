/**
 * Fase 1.8.8 — Immutable invariants (READ-ONLY).
 */

import type {
  ImmutableInvariant,
  ImmutableViolation,
} from './immutableTypes';
import type { ImmutableSignal } from './immutableSeal';

export function validateImmutableInvariants(s: ImmutableSignal): readonly ImmutableInvariant[] {
  return [
    { name: 'liveExecutionEnabled_false', satisfied: !s.liveExecutionEnabled, detail: 'live_execution_must_be_false' },
    { name: 'retryEnabled_false', satisfied: !s.retryEnabled, detail: 'retry_must_be_false' },
    { name: 'backgroundEnabled_false', satisfied: !s.backgroundEnabled, detail: 'background_must_be_false' },
    { name: 'realUsersAllowed_false', satisfied: !s.realUsersAllowed, detail: 'real_users_must_be_false' },
    { name: 'currentStage_read_only', satisfied: !s.currentStage || s.currentStage === 'STAGE_0_READ_ONLY', detail: 'stage_must_be_read_only' },
  ];
}

export function detectInvariantBreak(s: ImmutableSignal): ImmutableViolation | null {
  const inv = validateImmutableInvariants(s);
  const broken = inv.find(i => !i.satisfied);
  if (!broken) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'runtime_mutation',
    severity: 'CRITICAL', detail: `invariant_broken_${broken.name}`,
  };
}

export function detectDeterminismViolation(
  a: { score: number; classification: string },
  b: { score: number; classification: string },
): boolean {
  return a.score !== b.score || a.classification !== b.classification;
}

export interface RegressionSignal {
  readonly previousClassification: string;
  readonly currentClassification: string;
}

const RANK: Record<string, number> = {
  IMMUTABLE: 0, SEALED: 1, GUARDED: 2, RESTRICTED: 3, COMPROMISED: 4,
};

export function detectRuntimeRegression(r: RegressionSignal): boolean {
  const prev = RANK[r.previousClassification] ?? 0;
  const cur = RANK[r.currentClassification] ?? 0;
  return cur > prev;
}

export function detectUnsafeInvariantMutation(s: ImmutableSignal): ImmutableViolation | null {
  if (!s.liveExecutionEnabled && !s.retryEnabled && !s.backgroundEnabled && !s.realUsersAllowed) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'runtime_mutation',
    severity: 'CRITICAL', detail: 'unsafe_invariant_mutation',
  };
}
