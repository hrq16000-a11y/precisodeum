/**
 * Fase 1.7.4 — Runtime telemetry aggregators (PURE, READ-ONLY).
 *
 * Funções determinísticas: mesma entrada → mesma saída. Sem Supabase, sem
 * hooks, sem timers, sem fetch, sem window/localStorage.
 */

import {
  OPERATION_REGISTRY,
  type BoundaryId,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { FLOW_DRIFT_PROFILES, getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type {
  BoundaryExecutionTelemetry,
  DriftTelemetry,
  FlowExecutionTelemetry,
  MirrorUsageTelemetry,
  OperationalRiskLevel,
  OperationalRiskTelemetry,
  RuntimeTelemetryEvent,
  TelemetryAggregation,
  TelemetryConfidence,
} from './runtimeTelemetryTypes';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function rate(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 1000;
}

export function confidenceFromVolume(n: number): TelemetryConfidence {
  if (n <= 0) return 'none';
  if (n < 5) return 'low';
  if (n < 25) return 'medium';
  return 'high';
}

function emptyFlowEntry(flow: FlowId): FlowExecutionTelemetry {
  return {
    flow,
    executions: 0,
    failures: 0,
    partialSuccesses: 0,
    rollbacks: 0,
    failureRate: 0,
    partialRate: 0,
    rollbackRate: 0,
    confidence: 'none',
  };
}

// ---------------------------------------------------------------------------
// aggregateFlowTelemetry
// ---------------------------------------------------------------------------

export function aggregateFlowTelemetry(
  events: ReadonlyArray<RuntimeTelemetryEvent>,
): FlowExecutionTelemetry[] {
  const byFlow = new Map<FlowId, FlowExecutionTelemetry>();
  for (const reg of OPERATION_REGISTRY) byFlow.set(reg.flow, emptyFlowEntry(reg.flow));

  for (const ev of events) {
    if (!ev.flow) continue;
    const entry = byFlow.get(ev.flow);
    if (!entry) continue;
    if (ev.kind === 'flow_execution') entry.executions++;
    else if (ev.kind === 'flow_failure') {
      entry.failures++;
      entry.executions++;
    } else if (ev.kind === 'flow_partial_success') {
      entry.partialSuccesses++;
      entry.executions++;
    } else if (ev.kind === 'rollback_invoked') entry.rollbacks++;
  }

  for (const entry of byFlow.values()) {
    entry.failureRate = rate(entry.failures, entry.executions);
    entry.partialRate = rate(entry.partialSuccesses, entry.executions);
    entry.rollbackRate = rate(entry.rollbacks, entry.executions);
    entry.confidence = confidenceFromVolume(entry.executions);
  }
  return [...byFlow.values()];
}

// ---------------------------------------------------------------------------
// aggregateBoundaryTelemetry
// ---------------------------------------------------------------------------

export function aggregateBoundaryTelemetry(
  events: ReadonlyArray<RuntimeTelemetryEvent>,
): BoundaryExecutionTelemetry[] {
  const boundaries = new Map<BoundaryId, BoundaryExecutionTelemetry>();
  for (const reg of OPERATION_REGISTRY) {
    if (!boundaries.has(reg.boundary)) {
      boundaries.set(reg.boundary, {
        boundary: reg.boundary,
        executions: 0,
        failures: 0,
        failureRate: 0,
        flows: [],
        confidence: 'none',
      });
    }
    const b = boundaries.get(reg.boundary)!;
    if (!b.flows.includes(reg.flow)) b.flows.push(reg.flow);
  }
  for (const ev of events) {
    if (!ev.boundary) continue;
    const b = boundaries.get(ev.boundary);
    if (!b) continue;
    if (ev.kind === 'boundary_execution') b.executions++;
    else if (ev.kind === 'boundary_failure') {
      b.failures++;
      b.executions++;
    }
  }
  for (const b of boundaries.values()) {
    b.failureRate = rate(b.failures, b.executions);
    b.confidence = confidenceFromVolume(b.executions);
  }
  return [...boundaries.values()];
}

// ---------------------------------------------------------------------------
// aggregateMirrorTelemetry
// ---------------------------------------------------------------------------

export function aggregateMirrorTelemetry(
  events: ReadonlyArray<RuntimeTelemetryEvent>,
  flowExec: ReadonlyArray<FlowExecutionTelemetry>,
): MirrorUsageTelemetry[] {
  const execMap = new Map(flowExec.map((f) => [f.flow, f.executions]));
  const counts = new Map<FlowId, number>();
  for (const ev of events) {
    if (!ev.flow) continue;
    if (ev.kind !== 'mirror_write') continue;
    counts.set(ev.flow, (counts.get(ev.flow) ?? 0) + 1);
  }
  const out: MirrorUsageTelemetry[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const total = execMap.get(reg.flow) ?? 0;
    const mirrorWrites = counts.get(reg.flow) ?? 0;
    out.push({
      flow: reg.flow,
      mirrorWrites,
      totalExecutions: total,
      mirrorRate: rate(mirrorWrites, total),
      hasOwnershipResolved: reg.ownership !== 'mixed' || !!getFlowDriftProfile(reg.flow),
      confidence: confidenceFromVolume(total),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// aggregateDriftTelemetry
// ---------------------------------------------------------------------------

export function aggregateDriftTelemetry(
  events: ReadonlyArray<RuntimeTelemetryEvent>,
  flowExec: ReadonlyArray<FlowExecutionTelemetry>,
): DriftTelemetry[] {
  const execMap = new Map(flowExec.map((f) => [f.flow, f.executions]));
  const drift = new Map<FlowId, number>();
  const blocked = new Map<FlowId, number>();
  for (const ev of events) {
    if (!ev.flow) continue;
    if (ev.kind === 'drift_detected') drift.set(ev.flow, (drift.get(ev.flow) ?? 0) + 1);
    else if (ev.kind === 'reconciliation_blocked')
      blocked.set(ev.flow, (blocked.get(ev.flow) ?? 0) + 1);
  }
  const out: DriftTelemetry[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const total = execMap.get(reg.flow) ?? 0;
    const driftEvents = drift.get(reg.flow) ?? 0;
    out.push({
      flow: reg.flow,
      driftEvents,
      totalExecutions: total,
      driftRate: rate(driftEvents, Math.max(total, driftEvents)),
      reconciliationBlocked: blocked.get(reg.flow) ?? 0,
      confidence: confidenceFromVolume(total + driftEvents),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// calculateOperationalRisk
// ---------------------------------------------------------------------------

function levelFromScore(score: number): OperationalRiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

export function calculateOperationalRisk(
  flowExec: ReadonlyArray<FlowExecutionTelemetry>,
  drifts: ReadonlyArray<DriftTelemetry>,
  mirrors: ReadonlyArray<MirrorUsageTelemetry>,
): OperationalRiskTelemetry[] {
  const driftMap = new Map(drifts.map((d) => [d.flow, d]));
  const mirrorMap = new Map(mirrors.map((m) => [m.flow, m]));
  const execMap = new Map(flowExec.map((f) => [f.flow, f]));
  const out: OperationalRiskTelemetry[] = [];

  for (const reg of OPERATION_REGISTRY) {
    const exec = execMap.get(reg.flow);
    const drift = driftMap.get(reg.flow);
    const mirror = mirrorMap.get(reg.flow);
    const profile = getFlowDriftProfile(reg.flow);
    const contributors: string[] = [];
    let score = 0;

    if (reg.steps.length > 1 && reg.supportsAtomic && reg.readiness !== 'READY') {
      score += 25;
      contributors.push('multi_write_non_atomic');
    }
    if (reg.readiness === 'PARTIAL') {
      score += 15;
      contributors.push('partial_readiness');
    }
    if (reg.readiness === 'BLOCKED') {
      score += 35;
      contributors.push('blocked_readiness');
    }
    if (!reg.supportsRollback && reg.steps.length > 1) {
      score += 10;
      contributors.push('missing_rollback');
    }
    if (profile?.depends_on_eventual_sync) {
      score += 10;
      contributors.push('eventual_sync_dependency');
    }
    if (profile?.depends_on_mirror) {
      score += 5;
      contributors.push('mirror_dependency');
    }
    if (exec && exec.failureRate >= 0.1) {
      score += 15;
      contributors.push('high_failure_rate');
    }
    if (drift && drift.driftRate >= 0.1) {
      score += 15;
      contributors.push('high_drift_rate');
    }
    if (mirror && mirror.mirrorRate >= 0.5) {
      score += 5;
      contributors.push('mirror_overuse');
    }
    if (reg.ownership === 'mixed') {
      score += 5;
      contributors.push('mixed_ownership');
    }

    score = Math.min(100, score);
    out.push({
      flow: reg.flow,
      riskLevel: levelFromScore(score),
      riskScore: score,
      contributors,
      readiness: reg.readiness,
      exposesEventualConsistency: !!profile?.depends_on_eventual_sync,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildRuntimeTelemetry — aggregator canônico
// ---------------------------------------------------------------------------

export interface BuildRuntimeTelemetryOptions {
  now?: () => number;
}

export function buildRuntimeTelemetry(
  events: ReadonlyArray<RuntimeTelemetryEvent>,
  opts: BuildRuntimeTelemetryOptions = {},
): TelemetryAggregation {
  const now = (opts.now ?? (() => 0))();
  const flows = aggregateFlowTelemetry(events);
  const boundaries = aggregateBoundaryTelemetry(events);
  const mirrors = aggregateMirrorTelemetry(events, flows);
  const drifts = aggregateDriftTelemetry(events, flows);
  const risks = calculateOperationalRisk(flows, drifts, mirrors);

  const totalExec = flows.reduce((a, f) => a + f.executions, 0);

  return {
    generatedAt: now,
    totalEvents: events.length,
    flows,
    boundaries,
    mirrors,
    drifts,
    risks,
    health: [],
    priorities: [],
    overallConfidence: confidenceFromVolume(totalExec),
  };
}

// Coverage assertion — todo flow do registry está presente.
export function assertTelemetryCoverage(agg: TelemetryAggregation): {
  ok: boolean;
  missing: FlowId[];
} {
  const present = new Set(agg.flows.map((f) => f.flow));
  const missing = OPERATION_REGISTRY.map((r) => r.flow).filter((f) => !present.has(f));
  return { ok: missing.length === 0, missing };
}

// Re-export for convenience
export { FLOW_DRIFT_PROFILES };
