/**
 * Fase 1.7.6 — Staged migration model (READ-ONLY).
 * Apenas descreve estágios formais. Não executa nada.
 */

import type {
  MigrationStageDescriptor,
  MigrationStageId,
} from './atomicBlueprintTypes';

export const MIGRATION_STAGE_ORDER: readonly MigrationStageId[] = [
  'STAGE_0_READ_ONLY',
  'STAGE_1_SHADOW_COMPARE',
  'STAGE_2_DUAL_EXECUTION',
  'STAGE_3_SOFT_ATOMIC',
  'STAGE_4_HARD_ATOMIC',
  'STAGE_5_LEGACY_REMOVAL',
] as const;

export const MIGRATION_STAGES: readonly MigrationStageDescriptor[] = [
  {
    id: 'STAGE_0_READ_ONLY',
    prerequisites: ['operation_registry_complete', 'drift_detection_active'],
    blockers: [],
    rollback_strategy: 'noop_rollback',
    allowed_failures: ['observability_emit_failed'],
    observability_requirements: ['audit_log', 'consistency_snapshot'],
    safety_guarantees: ['no_write_change'],
    revert_complexity: 'LOW',
    monitoring_requirements: ['drift_rate', 'classification_distribution'],
  },
  {
    id: 'STAGE_1_SHADOW_COMPARE',
    prerequisites: ['STAGE_0_READ_ONLY', 'telemetry_aggregation_available'],
    blockers: ['unsafe_writes_detected'],
    rollback_strategy: 'noop_rollback',
    allowed_failures: ['shadow_comparison_mismatch'],
    observability_requirements: ['shadow_diff_audit'],
    safety_guarantees: ['legacy_path_unchanged'],
    revert_complexity: 'LOW',
    monitoring_requirements: ['shadow_divergence_rate'],
  },
  {
    id: 'STAGE_2_DUAL_EXECUTION',
    prerequisites: ['STAGE_1_SHADOW_COMPARE', 'rollback_strategy_defined'],
    blockers: ['rollback_undefined', 'topology_unsafe'],
    rollback_strategy: 'compensating_write',
    allowed_failures: ['secondary_write_failed_with_compensation'],
    observability_requirements: ['dual_write_divergence_audit'],
    safety_guarantees: ['legacy_remains_canonical'],
    revert_complexity: 'MEDIUM',
    monitoring_requirements: ['dual_execution_divergence_rate'],
  },
  {
    id: 'STAGE_3_SOFT_ATOMIC',
    prerequisites: ['STAGE_2_DUAL_EXECUTION', 'atomic_feasibility_FEASIBLE'],
    blockers: ['atomic_feasibility_INFEASIBLE', 'consistency_gap'],
    rollback_strategy: 'safe_retry',
    allowed_failures: ['atomic_retry_exhausted_fallback_to_legacy'],
    observability_requirements: ['atomic_path_audit', 'fallback_audit'],
    safety_guarantees: ['legacy_fallback_available'],
    revert_complexity: 'MEDIUM',
    monitoring_requirements: ['atomic_success_rate', 'fallback_rate'],
  },
  {
    id: 'STAGE_4_HARD_ATOMIC',
    prerequisites: ['STAGE_3_SOFT_ATOMIC', 'atomic_success_rate_above_threshold'],
    blockers: ['rollback_undefined', 'consistency_gap'],
    rollback_strategy: 'hard_abort',
    allowed_failures: [],
    observability_requirements: ['atomic_path_audit'],
    safety_guarantees: ['single_source_of_truth'],
    revert_complexity: 'HIGH',
    monitoring_requirements: ['atomic_error_rate'],
  },
  {
    id: 'STAGE_5_LEGACY_REMOVAL',
    prerequisites: ['STAGE_4_HARD_ATOMIC', 'legacy_path_unused_for_grace_period'],
    blockers: ['legacy_traffic_observed'],
    rollback_strategy: 'hard_abort',
    allowed_failures: [],
    observability_requirements: ['legacy_path_zero_traffic_audit'],
    safety_guarantees: ['legacy_code_removed'],
    revert_complexity: 'CRITICAL',
    monitoring_requirements: ['legacy_call_count_eq_zero'],
  },
] as const;

export function getStage(id: MigrationStageId): MigrationStageDescriptor | undefined {
  return MIGRATION_STAGES.find((s) => s.id === id);
}

export function nextStage(id: MigrationStageId): MigrationStageId | null {
  const idx = MIGRATION_STAGE_ORDER.indexOf(id);
  if (idx < 0 || idx >= MIGRATION_STAGE_ORDER.length - 1) return null;
  return MIGRATION_STAGE_ORDER[idx + 1];
}
