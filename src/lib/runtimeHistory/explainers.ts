/**
 * Fase 1.8.1 — Pure deterministic explainers (READ-ONLY).
 */

import type {
  RuntimeHistoryHealth,
  RuntimeLineage,
  RuntimePropagationChain,
  RuntimeTrendDirection,
} from './runtimeHistoryTypes';
import type { TemporalComparison } from './temporalConsistency';

export function explainRuntimeHistory(h: RuntimeHistoryHealth): string {
  return `flow=${h.flow} severity=${h.severity} confidence=${h.confidence} lineage=${h.lineage.class} propagation=${h.propagation.risk}`;
}

export function explainRuntimeTrend(direction: RuntimeTrendDirection): string {
  switch (direction) {
    case 'improving': return 'tendência de melhoria estável';
    case 'stable': return 'comportamento estável sem regressão';
    case 'degrading': return 'tendência de degradação detectada';
    case 'volatile': return 'série instável; análise inconclusiva';
    default: return 'tendência indeterminada (amostragem insuficiente)';
  }
}

export function explainRuntimeLineage(l: RuntimeLineage): string {
  return `lineage=${l.class} owners=${l.owners.length} mirrors=${l.mirrors.length} finalizers=${l.finalizers.length} gaps=${l.gaps.length}`;
}

export function explainPropagationRisk(c: RuntimePropagationChain): string {
  return `propagation=${c.risk} nodes=${c.nodes.length} edges=${c.edges.length} cycle=${c.cycle.length} hidden=${c.hidden.length}`;
}

export function explainTemporalConsistency(c: TemporalComparison): string {
  return `temporal=${c.class} ordering_regression=${c.orderingRegression} parity_regression=${c.parityRegression}`;
}

export function explainHistoricalParityGap(flow: string, gap: number): string {
  return `historical_parity_gap flow=${flow} gap=${gap.toFixed(3)}`;
}
