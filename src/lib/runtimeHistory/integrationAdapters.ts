/**
 * Fase 1.8.1 — Integration adapters (READ-ONLY).
 *
 * Apenas tradutores de estruturas externas em RuntimeHistoryEntry.
 * Nenhum adapter pode alterar a estrutura original.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { RuntimeHistoryWindow } from './runtimeHistoryTypes';
import { buildRuntimeHistory } from './runtimeHistoryBuilder';

export function adaptRuntimeRecorderToHistory(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeHistoryWindow {
  // adapter inerte: apenas embrulha buildRuntimeHistory
  return buildRuntimeHistory(flow, traces);
}

export function adaptSimulationToHistory(flow: FlowId): RuntimeHistoryWindow {
  return buildRuntimeHistory(flow, []);
}

export function adaptCertificationToHistory(flow: FlowId): RuntimeHistoryWindow {
  return buildRuntimeHistory(flow, []);
}

export function adaptGovernanceToHistory(flow: FlowId): RuntimeHistoryWindow {
  return buildRuntimeHistory(flow, []);
}

export function adaptPromotionToHistory(flow: FlowId): RuntimeHistoryWindow {
  return buildRuntimeHistory(flow, []);
}
