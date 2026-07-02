/**
 * Fase 1.8.1 — History builder (READ-ONLY).
 *
 * Constrói janelas históricas determinísticas a partir de traces já
 * observados. Sem storage, sem retries, sem persistência. Tudo em memória.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type {
  RuntimeHistoryEntry,
  RuntimeHistoryWindow,
  RuntimeTrendDirection,
} from './runtimeHistoryTypes';

let entryCounter = 0;
function nextEntryId(flow: FlowId): string {
  entryCounter = (entryCounter + 1) % 1_000_000;
  return `hist:${flow}:${entryCounter}`;
}

function traceToEntry(
  trace: RuntimeWriteTrace,
  sequence: number,
  logicalTimestamp: number,
): RuntimeHistoryEntry {
  return {
    id: nextEntryId(trace.flow),
    flow: trace.flow,
    traceId: trace.id,
    sequence,
    logicalTimestamp,
    classification: trace.classification,
    severity: trace.severity,
    consistency: trace.consistency,
    ordering: trace.ordering.class,
    failure: trace.failureSummary,
    mirrorDependent: trace.mirrorDependent,
    orphanRisk: trace.orphanRisk,
    liveExecution: false,
    persisted: false,
    retry: false,
    background: false,
    realUserMutation: false,
  };
}

export function buildRuntimeHistory(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeHistoryWindow {
  const filtered = traces.filter((t) => t.flow === flow);
  const entries = filtered.map((t, i) => traceToEntry(t, i, i));
  return {
    flow,
    entries,
    windowSize: entries.length,
    firstSequence: entries[0]?.sequence ?? 0,
    lastSequence: entries[entries.length - 1]?.sequence ?? 0,
  };
}

export function appendRuntimeHistoryEntry(
  window: RuntimeHistoryWindow,
  trace: RuntimeWriteTrace,
): RuntimeHistoryWindow {
  if (trace.flow !== window.flow) return window;
  const seq = window.entries.length;
  const entry = traceToEntry(trace, seq, seq);
  const entries = [...window.entries, entry];
  return {
    flow: window.flow,
    entries,
    windowSize: entries.length,
    firstSequence: entries[0]?.sequence ?? 0,
    lastSequence: entries[entries.length - 1]?.sequence ?? 0,
  };
}

export interface RuntimeHistorySummary {
  readonly flow: FlowId;
  readonly samples: number;
  readonly consistentRatio: number;
  readonly orphanRatio: number;
  readonly inconsistentRatio: number;
  readonly mirrorRatio: number;
  readonly orderingViolationRatio: number;
  readonly criticalCount: number;
  readonly worstSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const SEV_RANK = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;

export function summarizeRuntimeHistory(
  window: RuntimeHistoryWindow,
): RuntimeHistorySummary {
  const total = window.entries.length || 1;
  let consistent = 0, orphan = 0, inconsistent = 0, mirror = 0, ordering = 0, critical = 0;
  let worst: RuntimeHistorySummary['worstSeverity'] = 'NONE';
  for (const e of window.entries) {
    if (e.consistency === 'consistent') consistent++;
    if (e.consistency === 'orphaned') orphan++;
    if (e.consistency === 'inconsistent') inconsistent++;
    if (e.mirrorDependent) mirror++;
    if (e.ordering !== 'expected') ordering++;
    if (e.classification === 'CRITICAL') critical++;
    if (SEV_RANK[e.severity] > SEV_RANK[worst]) worst = e.severity;
  }
  return {
    flow: window.flow,
    samples: window.entries.length,
    consistentRatio: consistent / total,
    orphanRatio: orphan / total,
    inconsistentRatio: inconsistent / total,
    mirrorRatio: mirror / total,
    orderingViolationRatio: ordering / total,
    criticalCount: critical,
    worstSeverity: worst,
  };
}

/**
 * Calcula a direção de uma série numérica comparando a primeira metade
 * vs. a segunda metade. Deterministic.
 */
export function calculateHistoryTrend(
  series: readonly number[],
  opts: { higherIsBetter: boolean } = { higherIsBetter: false },
): RuntimeTrendDirection {
  if (series.length < 2) return 'unknown';
  const mid = Math.floor(series.length / 2);
  const a = series.slice(0, mid);
  const b = series.slice(mid);
  if (a.length === 0 || b.length === 0) return 'unknown';
  const avg = (xs: readonly number[]) => xs.reduce((s, n) => s + n, 0) / xs.length;
  const mA = avg(a);
  const mB = avg(b);
  const variance = (xs: readonly number[]) => {
    const m = avg(xs);
    return xs.reduce((s, n) => s + (n - m) * (n - m), 0) / xs.length;
  };
  const vA = variance(a);
  const vB = variance(b);
  const delta = mB - mA;
  const eps = 0.05;
  if (Math.abs(delta) < eps && Math.max(vA, vB) < eps) return 'stable';
  if (Math.max(vA, vB) > 0.25) return 'volatile';
  if (opts.higherIsBetter) {
    if (delta > eps) return 'improving';
    if (delta < -eps) return 'degrading';
  } else {
    if (delta < -eps) return 'improving';
    if (delta > eps) return 'degrading';
  }
  return 'stable';
}

export function detectRuntimeInstability(window: RuntimeHistoryWindow): boolean {
  if (window.entries.length < 3) return false;
  const sevSeries = window.entries.map((e) => SEV_RANK[e.severity]);
  // 3+ alternâncias de severity → instabilidade
  let flips = 0;
  for (let i = 2; i < sevSeries.length; i++) {
    const a = Math.sign(sevSeries[i - 1] - sevSeries[i - 2]);
    const b = Math.sign(sevSeries[i] - sevSeries[i - 1]);
    if (a !== 0 && b !== 0 && a !== b) flips++;
  }
  return flips >= 2;
}

export function detectRuntimeRegression(window: RuntimeHistoryWindow): boolean {
  if (window.entries.length < 4) return false;
  const sevSeries = window.entries.map((e) => SEV_RANK[e.severity]);
  const mid = Math.floor(sevSeries.length / 2);
  const a = sevSeries.slice(0, mid);
  const b = sevSeries.slice(mid);
  const avg = (xs: number[]) => xs.reduce((s, n) => s + n, 0) / xs.length;
  return avg(b) > avg(a) + 0.5;
}

export function calculateRuntimeConfidence(window: RuntimeHistoryWindow): number {
  const samples = window.entries.length;
  if (samples === 0) return 0;
  const s = summarizeRuntimeHistory(window);
  // confiança baseia-se em: consistência alta, sem orphan, severity baixa, sem ordering
  const base = s.consistentRatio;
  const penalty =
    s.orphanRatio * 0.5 +
    s.inconsistentRatio * 0.4 +
    s.orderingViolationRatio * 0.3 +
    (s.criticalCount > 0 ? 0.5 : 0);
  const sampleBoost = Math.min(samples / 10, 1) * 0.1;
  const conf = Math.max(0, Math.min(1, base - penalty + sampleBoost));
  return Number(conf.toFixed(3));
}
