/**
 * Fase 1.8.1 — History aggregation (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { calculateRuntimeParityGap } from '@/lib/runtimeRecorder/runtimeComparison';
import type {
  RuntimeConsistencyTrend,
  RuntimeDriftTrend,
  RuntimeFailureTrend,
  RuntimeHistoryHealth,
  RuntimeHistorySeverity,
  RuntimeHistoryWindow,
  RuntimeOrderingTrend,
  RuntimeParityTrend,
} from './runtimeHistoryTypes';
import { buildRuntimeHistory, calculateHistoryTrend, calculateRuntimeConfidence, summarizeRuntimeHistory } from './runtimeHistoryBuilder';
import { buildRuntimeLineage } from './runtimeLineage';
import { buildPropagationChain } from './propagationAnalysis';
import { calculateRuntimeHealthTrend, detectEscalatingFailures } from './runtimeTrendAnalysis';

const SEV: Record<RuntimeHistorySeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export function aggregateRuntimeHistory(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeHistoryWindow {
  return buildRuntimeHistory(flow, traces);
}

export function summarizeHistoryRisk(window: RuntimeHistoryWindow): RuntimeHistorySeverity {
  const s = summarizeRuntimeHistory(window);
  if (s.criticalCount > 0) return 'CRITICAL';
  if (s.orphanRatio > 0.2 || s.inconsistentRatio > 0.2) return 'HIGH';
  if (s.orderingViolationRatio > 0.15 || s.mirrorRatio > 0.2) return 'MEDIUM';
  if (s.consistentRatio < 0.9) return 'LOW';
  return 'NONE';
}

export function summarizeHistoryParity(
  window: RuntimeHistoryWindow,
  traces: readonly RuntimeWriteTrace[],
): RuntimeParityTrend {
  const gaps = traces
    .filter((t) => t.flow === window.flow)
    .map((t) => calculateRuntimeParityGap(t));
  const avg = gaps.length ? gaps.reduce((s, n) => s + n, 0) / gaps.length : 0;
  const max = gaps.length ? Math.max(...gaps) : 0;
  return {
    flow: window.flow,
    direction: calculateHistoryTrend(gaps, { higherIsBetter: false }),
    avgParityGap: Number(avg.toFixed(3)),
    maxParityGap: Number(max.toFixed(3)),
    samples: gaps.length,
  };
}

export function summarizeHistoryFailures(window: RuntimeHistoryWindow): RuntimeFailureTrend {
  const failures = window.entries.map((e) =>
    e.consistency === 'inconsistent' || e.consistency === 'orphaned' ? 1 : 0,
  );
  const total = window.entries.length || 1;
  return {
    flow: window.flow,
    direction: calculateHistoryTrend(failures, { higherIsBetter: false }),
    failureRatio: failures.reduce((s, n) => s + n, 0) / total,
    escalating: detectEscalatingFailures(window),
    samples: window.entries.length,
  };
}

function summarizeConsistency(window: RuntimeHistoryWindow): RuntimeConsistencyTrend {
  const s = summarizeRuntimeHistory(window);
  return {
    flow: window.flow,
    direction: calculateRuntimeHealthTrend(window),
    consistentRatio: s.consistentRatio,
    orphanRatio: s.orphanRatio,
    inconsistentRatio: s.inconsistentRatio,
    samples: s.samples,
  };
}

function summarizeDrift(window: RuntimeHistoryWindow): RuntimeDriftTrend {
  const driftSeries = window.entries.map((e) => (e.mirrorDependent || e.orphanRisk ? 1 : 0));
  const driftEvents = driftSeries.reduce((s, n) => s + n, 0);
  return {
    flow: window.flow,
    direction: calculateHistoryTrend(driftSeries, { higherIsBetter: false }),
    driftEvents,
    emergenceScore: Number((driftEvents / (window.entries.length || 1)).toFixed(3)),
    samples: window.entries.length,
  };
}

function summarizeOrdering(window: RuntimeHistoryWindow): RuntimeOrderingTrend {
  const violationsSeries = window.entries.map((e) => (e.ordering !== 'expected' ? 1 : 0));
  const violations = violationsSeries.reduce((s, n) => s + n, 0);
  return {
    flow: window.flow,
    direction: calculateHistoryTrend(violationsSeries, { higherIsBetter: false }),
    violations,
    violationRatio: violations / (window.entries.length || 1),
    samples: window.entries.length,
  };
}

export function buildRuntimeHistoryHealth(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeHistoryHealth {
  const window = buildRuntimeHistory(flow, traces);
  const consistency = summarizeConsistency(window);
  const parity = summarizeHistoryParity(window, traces);
  const drift = summarizeDrift(window);
  const ordering = summarizeOrdering(window);
  const failure = summarizeHistoryFailures(window);
  const lineage = buildRuntimeLineage(flow, traces);
  const propagation = buildPropagationChain(flow, traces);
  const baseSev = summarizeHistoryRisk(window);
  let severity: RuntimeHistorySeverity = baseSev;
  if (lineage.class === 'broken' || lineage.class === 'mirror_only') {
    if (SEV[severity] < SEV.HIGH) severity = 'HIGH';
  }
  if (propagation.risk === 'circular') {
    if (SEV[severity] < SEV.HIGH) severity = 'HIGH';
  }
  const confidence = calculateRuntimeConfidence(window);
  return {
    flow,
    severity,
    trends: { consistency, parity, drift, ordering, failure },
    lineage,
    propagation,
    confidence,
  };
}
