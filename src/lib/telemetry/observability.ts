/**
 * Fase 1.7.4 — Runtime telemetry observability (PII-free).
 *
 * Emite eventos de auditoria estruturais. Sem PII (sem nome, email, telefone,
 * endereço, URL, payload bruto). Apenas: flow, frequency, drift_rate,
 * mirror_rate, risk_level, priority, health, readiness.
 *
 * Fail-soft: nunca lança.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type {
  AtomicMigrationPriorityEntry,
  OperationalRiskTelemetry,
  RuntimeFlowHealth,
  TelemetryAggregation,
} from './runtimeTelemetryTypes';

export interface TelemetryAuditContext {
  source: string;
}

export async function logRuntimeTelemetryGenerated(
  ctx: TelemetryAuditContext,
  agg: TelemetryAggregation,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'runtime_telemetry_generated' as any,
      resource_type: 'runtime_telemetry',
      details: {
        source: ctx.source,
        total_events: agg.totalEvents,
        total_flows: agg.flows.length,
        confidence: agg.overallConfidence,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logOperationalRiskDetected(
  ctx: TelemetryAuditContext,
  risk: OperationalRiskTelemetry,
): Promise<void> {
  if (risk.riskLevel === 'LOW') return;
  try {
    await logAuditAction({
      action: 'operational_risk_detected' as any,
      resource_type: 'runtime_telemetry',
      details: {
        source: ctx.source,
        flow: risk.flow,
        risk_level: risk.riskLevel,
        risk_score: risk.riskScore,
        readiness: risk.readiness,
        eventual_consistency: risk.exposesEventualConsistency,
        contributors: risk.contributors,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logAtomicPriorityCalculated(
  ctx: TelemetryAuditContext,
  entry: AtomicMigrationPriorityEntry,
): Promise<void> {
  if (entry.priority === 'LOW') return;
  try {
    await logAuditAction({
      action: 'atomic_priority_calculated' as any,
      resource_type: 'runtime_telemetry',
      details: {
        source: ctx.source,
        flow: entry.flow,
        priority: entry.priority,
        score: entry.score,
        reasons: entry.reasons,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logFlowHealthDegraded(
  ctx: TelemetryAuditContext,
  health: RuntimeFlowHealth,
): Promise<void> {
  if (health.grade === 'A' || health.grade === 'B') return;
  try {
    await logAuditAction({
      action: 'flow_health_degraded' as any,
      resource_type: 'runtime_telemetry',
      details: {
        source: ctx.source,
        flow: health.flow,
        grade: health.grade,
        score: health.score,
        readiness: health.readiness,
        failure_rate: health.failureRate,
        drift_rate: health.driftRate,
        mirror_rate: health.mirrorRate,
        overcoupled: health.isOvercoupled,
        mirror_overdep: health.isOverdependentOnMirror,
        ready_but_degraded: health.isStructurallyReadyButOperationallyDegraded,
        confidence: health.confidence,
      },
    });
  } catch {
    /* fail-soft */
  }
}
