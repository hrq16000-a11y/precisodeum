/**
 * Fase 1.8.1 — Runtime history guards (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type {
  RuntimeHistoryEntry,
  RuntimeHistoryViolation,
  RuntimeHistoryWindow,
} from './runtimeHistoryTypes';
import type { TemporalComparison } from './temporalConsistency';
import { buildRuntimeLineage } from './runtimeLineage';
import { buildPropagationChain } from './propagationAnalysis';

function v(flow: FlowId | 'GLOBAL', code: RuntimeHistoryViolation['code'], detail: string): RuntimeHistoryViolation {
  return { flow, code, detail };
}

export function assertRuntimeHistoryIntegrity(window: RuntimeHistoryWindow): RuntimeHistoryViolation[] {
  const out: RuntimeHistoryViolation[] = [];
  for (const e of window.entries) {
    if ((e as unknown as { liveExecution: boolean }).liveExecution) {
      out.push(v(e.flow, 'live_execution_attempted', `entry ${e.id}`));
    }
    if ((e as unknown as { persisted: boolean }).persisted) {
      out.push(v(e.flow, 'persistence_attempted', `entry ${e.id}`));
    }
    if ((e as unknown as { retry: boolean }).retry) {
      out.push(v(e.flow, 'retry_attempted', `entry ${e.id}`));
    }
    if ((e as unknown as { background: boolean }).background) {
      out.push(v(e.flow, 'background_attempted', `entry ${e.id}`));
    }
  }
  return out;
}

export function assertNoUnsafeTemporalRegression(c: TemporalComparison): RuntimeHistoryViolation[] {
  if (c.class === 'severe_regression') {
    return [v(c.flow, 'temporal_regression', `class=${c.class}`)];
  }
  return [];
}

export function assertRuntimeLineageConsistency(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeHistoryViolation[] {
  const l = buildRuntimeLineage(flow, traces);
  const out: RuntimeHistoryViolation[] = [];
  if (l.class === 'broken' || l.class === 'mirror_only' || l.class === 'missing_owner') {
    out.push(v(flow, 'lineage_inconsistency', `class=${l.class} gaps=${l.gaps.length}`));
  }
  return out;
}

export function assertPropagationIntegrity(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeHistoryViolation[] {
  const p = buildPropagationChain(flow, traces);
  const out: RuntimeHistoryViolation[] = [];
  if (p.risk === 'circular') {
    out.push(v(flow, 'propagation_inconsistency', `cycle=${p.cycle.length}`));
  }
  return out;
}

export function assertTemporalConsistencyIntegrity(c: TemporalComparison): RuntimeHistoryViolation[] {
  if (c.parityRegression) {
    return [v(c.flow, 'parity_regression', `class=${c.class}`)];
  }
  return [];
}

export function assertNoHistoricalPromotionLeak(window: RuntimeHistoryWindow): RuntimeHistoryViolation[] {
  // Sentinel: nenhuma entry de history deve ter sinalizar promoção/rollout/pilot
  const out: RuntimeHistoryViolation[] = [];
  for (const e of window.entries as unknown as Array<RuntimeHistoryEntry & Record<string, unknown>>) {
    if ((e as Record<string, unknown>).rolloutActive) out.push(v(e.flow, 'rollout_attempted', e.id));
    if ((e as Record<string, unknown>).pilotActive) out.push(v(e.flow, 'pilot_attempted', e.id));
    if ((e as Record<string, unknown>).promotionLeak) out.push(v(e.flow, 'unsafe_promotion_leak', e.id));
  }
  return out;
}
