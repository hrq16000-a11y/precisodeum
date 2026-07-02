/**
 * Fase 1.7.4 — Atomic migration priority engine (PURE, READ-ONLY).
 *
 * Classifica quais flows devem virar RPC atômica primeiro. Determinístico.
 * Sem Supabase, hooks, timers ou fetch.
 *
 * Critérios (somatório → 0..100):
 *  - multi-write crítico
 *  - frequência operacional
 *  - drift frequency
 *  - mirror dependency
 *  - ausência de rollback
 *  - partial readiness
 *  - legacy classification
 *  - eventual consistency exposure
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { classifyFlowRegistration } from '@/lib/drift/writeClassification';
import type {
  AtomicMigrationPriority,
  AtomicMigrationPriorityEntry,
  DriftTelemetry,
  FlowExecutionTelemetry,
  MirrorUsageTelemetry,
  OperationalRiskTelemetry,
} from './runtimeTelemetryTypes';

function priorityFromScore(score: number): AtomicMigrationPriority {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

export function calculateAtomicMigrationPriority(
  flows: ReadonlyArray<FlowExecutionTelemetry>,
  drifts: ReadonlyArray<DriftTelemetry>,
  mirrors: ReadonlyArray<MirrorUsageTelemetry>,
  risks: ReadonlyArray<OperationalRiskTelemetry>,
): AtomicMigrationPriorityEntry[] {
  const execMap = new Map(flows.map((f) => [f.flow, f]));
  const driftMap = new Map(drifts.map((d) => [d.flow, d]));
  const mirrorMap = new Map(mirrors.map((m) => [m.flow, m]));
  const riskMap = new Map(risks.map((r) => [r.flow, r]));
  const out: AtomicMigrationPriorityEntry[] = [];

  for (const reg of OPERATION_REGISTRY) {
    const exec = execMap.get(reg.flow);
    const drift = driftMap.get(reg.flow);
    const mirror = mirrorMap.get(reg.flow);
    const risk = riskMap.get(reg.flow);
    const profile = getFlowDriftProfile(reg.flow);
    const cls = classifyFlowRegistration(reg);
    const reasons: string[] = [];
    let score = 0;

    if (reg.steps.length > 1) {
      score += 20;
      reasons.push('multi_step_write');
    }
    if (reg.supportsAtomic && reg.readiness !== 'READY') {
      score += 15;
      reasons.push('atomic_capable_not_ready');
    }
    if (reg.readiness === 'PARTIAL') {
      score += 10;
      reasons.push('partial_readiness');
    }
    if (!reg.supportsRollback && reg.steps.length > 1) {
      score += 10;
      reasons.push('missing_rollback');
    }
    if (profile?.depends_on_eventual_sync) {
      score += 10;
      reasons.push('eventual_consistency_exposure');
    }
    if (profile?.depends_on_mirror) {
      score += 5;
      reasons.push('mirror_dependency');
    }
    if (cls.classification === 'LEGACY') {
      score += 10;
      reasons.push('legacy_classification');
    }
    if (cls.classification === 'UNSAFE') {
      score += 30;
      reasons.push('unsafe_classification');
    }
    if (exec && exec.executions >= 25) {
      score += 10;
      reasons.push('high_execution_frequency');
    } else if (exec && exec.executions >= 5) {
      score += 5;
      reasons.push('medium_execution_frequency');
    }
    if (drift && drift.driftEvents > 0) {
      score += Math.min(15, drift.driftEvents);
      reasons.push('observed_drift');
    }
    if (mirror && mirror.mirrorRate >= 0.5) {
      score += 5;
      reasons.push('frequent_mirror_writes');
    }
    if (risk && (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL')) {
      score += 10;
      reasons.push('high_operational_risk');
    }

    score = Math.min(100, score);
    out.push({
      flow: reg.flow,
      priority: priorityFromScore(score),
      score,
      reasons,
    });
  }

  // Topo primeiro
  out.sort((a, b) => b.score - a.score);
  return out;
}
