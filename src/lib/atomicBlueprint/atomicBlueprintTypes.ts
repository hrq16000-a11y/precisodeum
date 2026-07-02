/**
 * Fase 1.7.6 — Atomic Migration Blueprint types (READ-ONLY).
 *
 * Modelagem determinística — sem Supabase, sem hooks, sem timers.
 * Todos os enums são strings literais estáveis para evitar drift de schema.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type AtomicRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MigrationStageId =
  | 'STAGE_0_READ_ONLY'
  | 'STAGE_1_SHADOW_COMPARE'
  | 'STAGE_2_DUAL_EXECUTION'
  | 'STAGE_3_SOFT_ATOMIC'
  | 'STAGE_4_HARD_ATOMIC'
  | 'STAGE_5_LEGACY_REMOVAL';

export type RollbackStrategyId =
  | 'compensating_write'
  | 'safe_retry'
  | 'noop_rollback'
  | 'hard_abort'
  | 'partial_visibility'
  | 'delayed_reconciliation';

export type ConsistencyLevel =
  | 'strong'
  | 'eventual'
  | 'mirror'
  | 'ownership'
  | 'finalize'
  | 'onboarding'
  | 'admin';

export type TopologyKind =
  | 'sequential'
  | 'parallel_safe'
  | 'atomic_required'
  | 'eventual_sync'
  | 'compensation_required'
  | 'mirror_propagation'
  | 'post_commit_effect';

export type DependencyRequirementKind =
  | 'ownership'
  | 'mirror'
  | 'finalize'
  | 'progress'
  | 'external_side_effect'
  | 'idempotency';

export type AtomicFeasibility = 'FEASIBLE' | 'CONDITIONAL' | 'INFEASIBLE';

export type BlueprintViolationCode =
  | 'BLUEPRINT_MISSING'
  | 'STAGE_INVALID'
  | 'ROLLBACK_UNDEFINED'
  | 'TOPOLOGY_UNSAFE'
  | 'ATOMICITY_IMPOSSIBLE'
  | 'CONSISTENCY_GAP'
  | 'DEPENDENCY_UNRESOLVED';

export interface DependencyRequirement {
  kind: DependencyRequirementKind;
  description: string;
  required: boolean;
}

export interface TopologyNode {
  step: string;
  kind: TopologyKind;
  /** safe to retry independently after partial failure */
  safeRetry: boolean;
}

export interface RecommendedRpcShape {
  /** PROPOSED only — não cria função real. */
  name: string;
  tables: string[];
  ordered_writes: string[];
  validations: string[];
  ownership_enforcement: string;
  rollback_semantics: RollbackStrategyId;
  observability_hooks: string[];
}

export interface OperationBlueprint {
  flow: FlowId;
  current_write_order: string[];
  required_atomic_boundaries: string[];
  rollback_requirements: RollbackStrategyId[];
  compensation_requirements: string[];
  eventual_consistency_risks: string[];
  ownership_dependencies: string[];
  mirror_dependencies: string[];
  finalize_dependencies: string[];
  progress_dependencies: string[];
  external_side_effects: string[];
  idempotency_requirements: string[];
  transactional_feasibility: AtomicFeasibility;
  recommended_rpc: RecommendedRpcShape;
  migration_complexity: AtomicRiskLevel;
  blast_radius: AtomicRiskLevel;
  observability_dependencies: string[];
  consistency_requirements: ConsistencyLevel[];
  topology: TopologyNode[];
  dependency_requirements: DependencyRequirement[];
}

export interface MigrationStageDescriptor {
  id: MigrationStageId;
  prerequisites: string[];
  blockers: string[];
  rollback_strategy: RollbackStrategyId;
  allowed_failures: string[];
  observability_requirements: string[];
  safety_guarantees: string[];
  revert_complexity: AtomicRiskLevel;
  monitoring_requirements: string[];
}

export interface BlueprintViolation {
  code: BlueprintViolationCode;
  flow?: FlowId;
  stage?: MigrationStageId;
  detail: string;
}

export interface AtomicReadinessMatrixRow {
  flow: FlowId;
  feasibility: AtomicFeasibility;
  risk: AtomicRiskLevel;
  current_stage: MigrationStageId;
  next_stage: MigrationStageId | null;
  rollback: RollbackStrategyId;
  consistency: ConsistencyLevel[];
}
