/**
 * Fase 1.7.6 — Observability emitters (PII-free).
 * Todas as emissões são fail-soft.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type {
  AtomicFeasibility,
  AtomicRiskLevel,
  BlueprintViolation,
  ConsistencyLevel,
  MigrationStageId,
  RollbackStrategyId,
  TopologyKind,
} from './atomicBlueprintTypes';
import type { FlowId } from '@/lib/operations/operationRegistry';

export interface BlueprintGeneratedPayload {
  flow: FlowId;
  feasibility: AtomicFeasibility;
  risk: AtomicRiskLevel;
  consistency_level: ConsistencyLevel[];
  rollback_type: RollbackStrategyId;
}

export async function logAtomicBlueprintGenerated(
  p: BlueprintGeneratedPayload,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'atomic_blueprint_generated' as any,
      resource_type: 'atomic_blueprint',
      details: { ...p },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logMigrationStageBlocked(
  flow: FlowId,
  stage: MigrationStageId,
  blocker: string,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'migration_stage_blocked' as any,
      resource_type: 'atomic_blueprint',
      details: { flow, stage, blocker },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logRollbackStrategyMissing(flow: FlowId): Promise<void> {
  try {
    await logAuditAction({
      action: 'rollback_strategy_missing' as any,
      resource_type: 'atomic_blueprint',
      details: { flow },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logTopologyRiskDetected(
  flow: FlowId,
  topology: TopologyKind,
  risk: AtomicRiskLevel,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'topology_risk_detected' as any,
      resource_type: 'atomic_blueprint',
      details: { flow, topology, risk },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logAtomicFeasibilityChanged(
  flow: FlowId,
  feasibility: AtomicFeasibility,
  dependency_type?: string,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'atomic_feasibility_changed' as any,
      resource_type: 'atomic_blueprint',
      details: { flow, feasibility, dependency_type: dependency_type ?? null },
    });
  } catch {
    /* fail-soft */
  }
}

export function violationToPayload(v: BlueprintViolation) {
  return {
    code: v.code,
    flow: v.flow ?? null,
    stage: v.stage ?? null,
    detail: v.detail,
  };
}
