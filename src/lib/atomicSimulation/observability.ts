/**
 * Fase 1.7.7 — Observability emitters (PII-free, fail-soft).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  BlastRadiusLevel,
  DivergenceKind,
  DivergenceSeverity,
  FailurePropagationKind,
  MigrationConfidence,
} from './simulationTypes';
import type { RollbackStrategyId } from '@/lib/atomicBlueprint/atomicBlueprintTypes';

async function emit(action: string, details: Record<string, unknown>) {
  try {
    await logAuditAction({
      action: action as any,
      resource_type: 'atomic_simulation',
      details,
    });
  } catch {
    /* fail-soft */
  }
}

export interface SimulationGeneratedPayload {
  flow: FlowId;
  rollback_type: RollbackStrategyId;
  blast_radius: BlastRadiusLevel;
  consistency: string[];
}

export async function logAtomicSimulationGenerated(
  p: SimulationGeneratedPayload,
): Promise<void> {
  await emit('atomic_simulation_generated', { ...p });
}

export async function logDivergenceDetected(
  flow: FlowId,
  kind: DivergenceKind,
  severity: DivergenceSeverity,
): Promise<void> {
  await emit('divergence_detected', { flow, kind, severity });
}

export async function logParityRegressionDetected(
  flow: FlowId,
  regressions: string[],
  score: number,
): Promise<void> {
  await emit('parity_regression_detected', { flow, regressions, score });
}

export async function logRollbackSimulationFailed(
  flow: FlowId,
  scenario: string,
): Promise<void> {
  await emit('rollback_simulation_failed', { flow, scenario });
}

export async function logBlastRadiusChanged(
  flow: FlowId,
  level: BlastRadiusLevel,
): Promise<void> {
  await emit('blast_radius_changed', { flow, level });
}

export async function logMigrationConfidenceChanged(
  flow: FlowId,
  confidence: MigrationConfidence,
  score: number,
): Promise<void> {
  await emit('migration_confidence_changed', { flow, confidence, score });
}

export async function logFailurePropagation(
  flow: FlowId,
  failure_type: FailurePropagationKind,
): Promise<void> {
  await emit('atomic_simulation_generated', {
    flow,
    failure_type,
    kind: 'failure_propagation',
  });
}
