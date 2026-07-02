/**
 * Fase 1.8.1 — Temporal consistency (READ-ONLY).
 *
 * Compara janelas históricas para detectar regressões temporais
 * determinísticas. Sem persistência, sem wall-clock.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeHistoryWindow } from './runtimeHistoryTypes';
import { summarizeRuntimeHistory } from './runtimeHistoryBuilder';

export type TemporalConsistencyClass =
  | 'stable'
  | 'improving'
  | 'degrading'
  | 'severe_regression'
  | 'unknown';

export interface TemporalComparison {
  readonly flow: FlowId;
  readonly class: TemporalConsistencyClass;
  readonly orderingRegression: boolean;
  readonly parityRegression: boolean;
  readonly orphanIncrease: number;
  readonly inconsistentIncrease: number;
  readonly orderingIncrease: number;
}

export function compareTemporalConsistency(
  prev: RuntimeHistoryWindow,
  next: RuntimeHistoryWindow,
): TemporalComparison {
  if (prev.flow !== next.flow) {
    return {
      flow: next.flow,
      class: 'unknown',
      orderingRegression: false,
      parityRegression: false,
      orphanIncrease: 0,
      inconsistentIncrease: 0,
      orderingIncrease: 0,
    };
  }
  const a = summarizeRuntimeHistory(prev);
  const b = summarizeRuntimeHistory(next);
  const orphanIncrease = b.orphanRatio - a.orphanRatio;
  const inconsistentIncrease = b.inconsistentRatio - a.inconsistentRatio;
  const orderingIncrease = b.orderingViolationRatio - a.orderingViolationRatio;
  const orderingRegression = orderingIncrease > 0.1;
  const consistencyDrop = a.consistentRatio - b.consistentRatio;
  const parityRegression =
    orphanIncrease > 0.05 ||
    inconsistentIncrease > 0.05 ||
    b.criticalCount > a.criticalCount ||
    consistencyDrop > 0.2;
  let cls: TemporalConsistencyClass = 'stable';
  if (b.consistentRatio < a.consistentRatio - 0.2) cls = 'severe_regression';
  else if (parityRegression || orderingRegression) cls = 'degrading';
  else if (b.consistentRatio > a.consistentRatio + 0.05) cls = 'improving';
  return {
    flow: next.flow,
    class: cls,
    orderingRegression,
    parityRegression,
    orphanIncrease,
    inconsistentIncrease,
    orderingIncrease,
  };
}

export function detectTemporalDrift(
  prev: RuntimeHistoryWindow,
  next: RuntimeHistoryWindow,
): boolean {
  const c = compareTemporalConsistency(prev, next);
  return c.class === 'degrading' || c.class === 'severe_regression';
}

export function detectTemporalOrderingRegression(
  prev: RuntimeHistoryWindow,
  next: RuntimeHistoryWindow,
): boolean {
  return compareTemporalConsistency(prev, next).orderingRegression;
}

export function detectTemporalParityRegression(
  prev: RuntimeHistoryWindow,
  next: RuntimeHistoryWindow,
): boolean {
  return compareTemporalConsistency(prev, next).parityRegression;
}

export function classifyTemporalConsistency(
  prev: RuntimeHistoryWindow,
  next: RuntimeHistoryWindow,
): TemporalConsistencyClass {
  return compareTemporalConsistency(prev, next).class;
}
