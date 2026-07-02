/**
 * Fase 1.8.1 — History comparison (READ-ONLY).
 *
 * Compara janelas históricas com simulation, blueprint, certification,
 * governance e runtimeRecorder. Apenas leitura.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { calculateRuntimeParityGap } from '@/lib/runtimeRecorder/runtimeComparison';
import type { RuntimeHistoryWindow } from './runtimeHistoryTypes';
import { summarizeRuntimeHistory } from './runtimeHistoryBuilder';

export interface HistoryToSimulationComparison {
  readonly flow: FlowId;
  readonly avgParityGap: number;
  readonly criticalSamples: number;
  readonly parityRegression: boolean;
}

export function compareHistoryToSimulation(
  window: RuntimeHistoryWindow,
  traces: readonly RuntimeWriteTrace[],
): HistoryToSimulationComparison {
  const flowTraces = traces.filter((t) => t.flow === window.flow);
  const gaps = flowTraces.map((t) => calculateRuntimeParityGap(t).gap);
  const avg = gaps.length ? gaps.reduce((s, n) => s + n, 0) / gaps.length : 0;
  const s = summarizeRuntimeHistory(window);
  return {
    flow: window.flow,
    avgParityGap: Number(avg.toFixed(3)),
    criticalSamples: s.criticalCount,
    parityRegression: avg > 30 || s.criticalCount > 0,
  };
}

export interface HistoryToCertificationComparison {
  readonly flow: FlowId;
  readonly meetsExecutionFloor: boolean;
  readonly meetsParityFloor: boolean;
  readonly meetsRollbackFloor: boolean;
}

export function compareHistoryToCertification(
  window: RuntimeHistoryWindow,
  traces: readonly RuntimeWriteTrace[],
): HistoryToCertificationComparison {
  const s = summarizeRuntimeHistory(window);
  const cmp = compareHistoryToSimulation(window, traces);
  return {
    flow: window.flow,
    meetsExecutionFloor: s.consistentRatio >= 0.95 && s.criticalCount === 0,
    meetsParityFloor: cmp.avgParityGap <= 15,
    meetsRollbackFloor: s.orphanRatio === 0 && !traces.some((t) => t.flow === window.flow && t.mirrorDependent),
  };
}

export interface HistoryToGovernanceComparison {
  readonly flow: FlowId;
  readonly governanceSafe: boolean;
  readonly requiresHardFreeze: boolean;
}

export function compareHistoryToGovernance(
  window: RuntimeHistoryWindow,
): HistoryToGovernanceComparison {
  const s = summarizeRuntimeHistory(window);
  return {
    flow: window.flow,
    governanceSafe: s.criticalCount === 0 && s.orphanRatio === 0 && s.inconsistentRatio < 0.05,
    requiresHardFreeze: s.criticalCount > 0 || s.orphanRatio > 0.3,
  };
}

export function calculateHistoricalParityGap(
  window: RuntimeHistoryWindow,
  traces: readonly RuntimeWriteTrace[],
): number {
  const cmp = compareHistoryToSimulation(window, traces);
  return cmp.avgParityGap;
}
