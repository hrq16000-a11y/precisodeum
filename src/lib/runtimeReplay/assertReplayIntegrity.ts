/**
 * Fase 1.8.2 — Aggregated replay integrity (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ReplayAuditAction,
  ReplayAuditPayload,
} from './replayObservability';
import { REPLAY_AUDIT_ACTIONS } from './replayObservability';
import type { ReplayViolation, RuntimeReplay } from './replayTypes';
import {
  assertNoUnsafeReplayPromotion,
  assertReplayCoverage,
  assertReplayDeterminism,
  assertReplayLineage,
  assertReplayObservability,
  assertReplayParity,
  assertReplayPropagation,
} from './replayGuards';

export function assertAllReplayIntegrity(input: {
  replays: readonly RuntimeReplay[];
  expectedFlows?: readonly FlowId[];
  auditPayloads?: readonly ReplayAuditPayload[];
  allowedAuditActions?: readonly ReplayAuditAction[];
}): ReplayViolation[] {
  const out: ReplayViolation[] = [];
  if (input.expectedFlows && input.expectedFlows.length > 0) {
    out.push(...assertReplayCoverage(input.replays, input.expectedFlows));
  }
  for (const r of input.replays) {
    out.push(...assertReplayDeterminism(r));
    out.push(...assertReplayParity(r));
    out.push(...assertReplayLineage(r));
    out.push(...assertReplayPropagation(r));
    out.push(...assertNoUnsafeReplayPromotion(r));
  }
  if (input.auditPayloads && input.auditPayloads.length > 0) {
    out.push(...assertReplayObservability(input.auditPayloads, input.allowedAuditActions ?? REPLAY_AUDIT_ACTIONS));
  }
  return out;
}
