/**
 * Fase 1.8.2 — Replay guards (READ-ONLY).
 *
 * Asserts independentes. Cada um retorna lista de violations (vazio = OK).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ReplayAuditAction,
  ReplayAuditPayload,
} from './replayObservability';
import { isReplayAuditPayloadPiiFree } from './replayObservability';
import type { ReplayViolation, RuntimeReplay } from './replayTypes';

export function assertReplayCoverage(
  replays: readonly RuntimeReplay[],
  expected: readonly FlowId[],
): ReplayViolation[] {
  const present = new Set(replays.map((r) => r.flow));
  return expected
    .filter((f) => !present.has(f))
    .map<ReplayViolation>((flow) => ({
      flow,
      code: 'missing_replay_flow',
      detail: `Flow ${flow} sem replay reconstruído.`,
    }));
}

export function assertReplayDeterminism(replay: RuntimeReplay): ReplayViolation[] {
  const v: ReplayViolation[] = [];
  if (replay.determinism.confidenceScore < 0.3 && replay.classification !== 'partially_deterministic') {
    v.push({
      flow: replay.flow,
      code: 'unsafe_replay_confidence',
      detail: `Confiança ${replay.determinism.confidenceScore} insuficiente para ${replay.classification}.`,
    });
  }
  return v;
}

export function assertReplayParity(replay: RuntimeReplay): ReplayViolation[] {
  if (replay.parity.regression && replay.parity.gap > 30) {
    return [{
      flow: replay.flow,
      code: 'parity_instability',
      detail: `Parity gap ${replay.parity.gap} acima do limite.`,
    }];
  }
  return [];
}

export function assertReplayLineage(replay: RuntimeReplay): ReplayViolation[] {
  if (replay.lineage.class === 'broken' || replay.lineage.class === 'orphaned' || replay.lineage.class === 'mirror_only') {
    return [{
      flow: replay.flow,
      code: 'broken_lineage',
      detail: `Lineage ${replay.lineage.class} (gaps=${replay.lineage.gaps.length}).`,
    }];
  }
  return [];
}

export function assertReplayPropagation(replay: RuntimeReplay): ReplayViolation[] {
  const v: ReplayViolation[] = [];
  if (replay.propagation.propagation === 'circular' || replay.topology.circularDependency) {
    v.push({
      flow: replay.flow,
      code: 'recursive_replay_propagation',
      detail: 'Ciclo detectado entre steps do flow.',
    });
  }
  if (replay.topology.hiddenDependency) {
    v.push({
      flow: replay.flow,
      code: 'hidden_replay_dependency',
      detail: 'Dependência observada que não aparece como step.',
    });
  }
  return v;
}

export function assertReplayObservability(
  payloads: readonly ReplayAuditPayload[],
  allowed: readonly ReplayAuditAction[],
): ReplayViolation[] {
  const allowedSet = new Set(allowed);
  const out: ReplayViolation[] = [];
  for (const p of payloads) {
    if (!allowedSet.has(p.action)) {
      out.push({
        flow: p.flow,
        code: 'parity_instability',
        detail: `Audit action ${p.action} fora do whitelist.`,
      });
    }
    if (!isReplayAuditPayloadPiiFree(p)) {
      out.push({
        flow: p.flow,
        code: 'parity_instability',
        detail: `Audit payload com PII (action=${p.action}).`,
      });
    }
  }
  return out;
}

export function assertNoUnsafeReplayPromotion(replay: RuntimeReplay): ReplayViolation[] {
  const v: ReplayViolation[] = [];
  if (replay.liveExecutionEnabled !== false) {
    v.push({ flow: replay.flow, code: 'live_execution_attempted', detail: 'liveExecutionEnabled deveria ser false.' });
  }
  if (replay.realUsersAllowed !== false) {
    v.push({ flow: replay.flow, code: 'unsafe_replay_promotion', detail: 'realUsersAllowed deveria ser false.' });
  }
  if (replay.retryEnabled !== false) {
    v.push({ flow: replay.flow, code: 'retry_attempted', detail: 'retryEnabled deveria ser false.' });
  }
  if (replay.backgroundEnabled !== false) {
    v.push({ flow: replay.flow, code: 'background_attempted', detail: 'backgroundEnabled deveria ser false.' });
  }
  if (replay.currentStage !== 'STAGE_0_READ_ONLY') {
    v.push({ flow: replay.flow, code: 'unsafe_replay_promotion', detail: `currentStage=${replay.currentStage}` });
  }
  return v;
}
