/**
 * Fase 1.8.1 — Aggregator integrity (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { RuntimeHistoryViolation } from './runtimeHistoryTypes';
import { buildRuntimeHistory } from './runtimeHistoryBuilder';
import {
  assertRuntimeHistoryIntegrity,
  assertRuntimeLineageConsistency,
  assertPropagationIntegrity,
  assertNoHistoricalPromotionLeak,
} from './runtimeHistoryGuards';

export function assertAllRuntimeHistoryIntegrity(
  perFlow: ReadonlyArray<{ flow: FlowId; traces: readonly RuntimeWriteTrace[] }>,
): RuntimeHistoryViolation[] {
  const out: RuntimeHistoryViolation[] = [];
  for (const { flow, traces } of perFlow) {
    const window = buildRuntimeHistory(flow, traces);
    out.push(...assertRuntimeHistoryIntegrity(window));
    out.push(...assertRuntimeLineageConsistency(flow, traces));
    out.push(...assertPropagationIntegrity(flow, traces));
    out.push(...assertNoHistoricalPromotionLeak(window));
  }
  return out;
}
