/**
 * Fase 1.8.0 — Trace aggregation + health (READ-ONLY).
 */

import type {
  RuntimeTraceClassification,
  RuntimeTraceSeverity,
  RuntimeWriteTrace,
  TraceFailureClass,
  TraceOrderingClass,
} from './recorderTypes';

export interface RuntimeTraceHealth {
  total: number;
  safe: number;
  partial: number;
  divergent: number;
  critical: number;
  mirrorDependent: number;
  orphanRisk: number;
  worstSeverity: RuntimeTraceSeverity;
  orderingViolationRate: number;
}

const SEV_ORDER: RuntimeTraceSeverity[] = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

function maxSev(a: RuntimeTraceSeverity, b: RuntimeTraceSeverity) {
  return SEV_ORDER.indexOf(b) > SEV_ORDER.indexOf(a) ? b : a;
}

export function aggregateRuntimeTraces(traces: RuntimeWriteTrace[]) {
  const byClass: Record<RuntimeTraceClassification, number> = {
    SAFE: 0,
    PARTIAL: 0,
    DIVERGENT: 0,
    ORPHAN_RISK: 0,
    MIRROR_DEPENDENT: 0,
    NON_ATOMIC: 0,
    EVENTUAL: 0,
    CRITICAL: 0,
  };
  for (const t of traces) byClass[t.classification] += 1;
  return { total: traces.length, byClass };
}

export function summarizeRuntimeFailures(traces: RuntimeWriteTrace[]) {
  const byClass: Record<TraceFailureClass, number> = {
    none: 0,
    transient: 0,
    validation: 0,
    authorization: 0,
    dependency: 0,
    ordering: 0,
    mirror_dependency: 0,
    orphan: 0,
    critical: 0,
  };
  for (const t of traces) byClass[t.failureSummary] += 1;
  return byClass;
}

export function summarizeRuntimeOrdering(traces: RuntimeWriteTrace[]) {
  const counts: Record<TraceOrderingClass, number> = {
    expected: 0,
    finalize_before_mirror: 0,
    mirror_before_owner: 0,
    progress_before_finalize: 0,
    out_of_order: 0,
    unsafe_dependency: 0,
  };
  for (const t of traces) {
    counts[t.ordering.class] += 1;
  }
  return counts;
}

export function buildRuntimeTraceHealth(
  traces: RuntimeWriteTrace[],
): RuntimeTraceHealth {
  const agg = aggregateRuntimeTraces(traces);
  let worst: RuntimeTraceSeverity = 'NONE';
  let orderingViolations = 0;
  for (const t of traces) {
    worst = maxSev(worst, t.severity);
    if (t.ordering.violations.length > 0) orderingViolations += 1;
  }
  return {
    total: agg.total,
    safe: agg.byClass.SAFE,
    partial: agg.byClass.PARTIAL,
    divergent: agg.byClass.DIVERGENT,
    critical: agg.byClass.CRITICAL,
    mirrorDependent: agg.byClass.MIRROR_DEPENDENT,
    orphanRisk: agg.byClass.ORPHAN_RISK,
    worstSeverity: worst,
    orderingViolationRate:
      agg.total === 0 ? 0 : Math.round((orderingViolations / agg.total) * 100),
  };
}
