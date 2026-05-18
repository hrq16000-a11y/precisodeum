/**
 * Fase 1.7.2 — Consistency Observatory observability (PII-free).
 *
 * Emite eventos read-only:
 *  - consistency_snapshot_generated (resumo do snapshot)
 *  - consistency_risk_detected (1 por risco)
 *  - consistency_snapshot_failed
 *
 * Payload restrito a: flow, risk, severity, execution_mode, has_boundary,
 * has_tracker, has_mirror, requires_dual_write, readiness.
 *
 * PROIBIDO: email, phone, whatsapp, city, address, cpf/cnpj, nome, URL, raw payloads.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type {
  ConsistencyFlowState,
  ConsistencyRisk,
  ConsistencySnapshot,
} from './snapshotTypes';

export interface ConsistencyAuditContext {
  source: string;
}

function flowAuditPayload(f: ConsistencyFlowState) {
  return {
    flow: f.flow,
    readiness: f.readiness,
    execution_mode: f.executionMode,
    has_boundary: f.boundaryState.hasCanonicalBoundary,
    has_tracker: f.boundaryState.hasTracker,
    has_mirror: f.mirrorState.hasMirror,
    requires_dual_write: f.requiresDualWrite,
    severity: f.severity,
  };
}

export async function logConsistencySnapshotGenerated(
  ctx: ConsistencyAuditContext,
  snapshot: ConsistencySnapshot,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'consistency_snapshot_generated' as any,
      resource_type: 'consistency_snapshot',
      details: {
        source: ctx.source,
        execution_mode: snapshot.executionMode,
        total_flows: snapshot.totalFlows,
        ready: snapshot.readyFlows,
        partial: snapshot.partialFlows,
        blocked: snapshot.blockedFlows,
        max_severity: snapshot.maxSeverity,
        severity_summary: snapshot.severitySummary,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logConsistencyRiskDetected(
  ctx: ConsistencyAuditContext,
  flow: ConsistencyFlowState,
  risk: ConsistencyRisk,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'consistency_risk_detected' as any,
      resource_type: 'consistency_snapshot',
      details: {
        source: ctx.source,
        ...flowAuditPayload(flow),
        risk: risk.type,
        risk_severity: risk.severity,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logConsistencySnapshotFailed(
  ctx: ConsistencyAuditContext,
  errorCode: string,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'consistency_snapshot_failed' as any,
      resource_type: 'consistency_snapshot',
      details: { source: ctx.source, error_code: errorCode },
    });
  } catch {
    /* fail-soft */
  }
}
