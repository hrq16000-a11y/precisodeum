/**
 * Fase 1.7.8 — Atomic Promotion Strategy types (READ-ONLY).
 *
 * Modelagem 100% determinística. Sem supabase, sem timers, sem write paths.
 * Apenas tipos, enums e estruturas estáveis para classificar elegibilidade
 * de promoção dos flows registrados.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  AtomicRiskLevel,
  RollbackStrategyId,
} from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';

export type AtomicPromotionStage =
  | 'DISABLED'
  | 'SHADOW_ONLY'
  | 'READY_FOR_PILOT'
  | 'PILOT_ENABLED'
  | 'SOFT_ATOMIC'
  | 'FULL_ATOMIC';

export type PromotionStageId =
  | 'STAGE_0_READ_ONLY'
  | 'STAGE_1_SHADOW_COMPARE'
  | 'STAGE_2_SOFT_PILOT'
  | 'STAGE_3_PARTIAL_ATOMIC'
  | 'STAGE_4_FULL_ATOMIC';

export type PromotionRisk = AtomicRiskLevel;

export type PromotionConfidence =
  | 'NONE'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'VERY_HIGH';

export type PromotionRollbackClass =
  | 'incompatible'
  | 'compensation_required'
  | 'safe_retry'
  | 'noop'
  | 'hard_abort';

export type PromotionDecision =
  | 'HOLD'
  | 'KEEP_SHADOW'
  | 'PROMOTE_TO_PILOT'
  | 'PROMOTE_TO_SOFT'
  | 'PROMOTE_TO_FULL'
  | 'BLOCKED';

export type PromotionBlockerCode =
  | 'unsafe_promotion_attempt'
  | 'forbidden_stage_transition'
  | 'missing_shadow_validation'
  | 'insufficient_parity'
  | 'missing_rollback'
  | 'unsafe_blast_radius'
  | 'unresolved_drift'
  | 'quarantined_dependency'
  | 'low_migration_confidence'
  | 'mirror_dependency_unresolved'
  | 'eventual_sync_dependency'
  | 'ownership_inconsistent'
  | 'unsafe_writes_present'
  | 'simulation_missing'
  | 'observability_gap';

export interface PromotionBlocker {
  code: PromotionBlockerCode;
  detail: string;
  severity: PromotionRisk;
}

export interface PromotionRequirement {
  id:
    | 'boundary_coverage'
    | 'contract_coverage'
    | 'simulation_coverage'
    | 'rollback_strategy'
    | 'drift_coverage'
    | 'observability_coverage';
  description: string;
  met: boolean;
}

export interface PromotionEligibility {
  flow: FlowId;
  requirements: PromotionRequirement[];
  metCount: number;
  totalCount: number;
  eligible: boolean;
}

export interface PromotionStageDescriptor {
  id: PromotionStageId;
  prerequisites: string[];
  blockers: PromotionBlockerCode[];
  rollbackBehavior: 'none' | 'partial' | 'full';
  requiredObservability: string[];
  requiredParityConfidence: PromotionConfidence;
  allowedFlows: FlowId[] | 'all';
  forbiddenConditions: string[];
}

export interface PromotionFlowState {
  flow: FlowId;
  currentStage: PromotionStageId;
  maxAllowedStage: PromotionStageId;
  decision: PromotionDecision;
  confidence: PromotionConfidence;
  risk: PromotionRisk;
  rollbackClass: PromotionRollbackClass;
  rollbackStrategy: RollbackStrategyId | null;
  blastRadius: BlastRadiusLevel;
  parityScore: number;
  blockers: PromotionBlocker[];
  recommendation: PromotionDecision;
}

export interface PromotionMatrix {
  rows: PromotionFlowState[];
  totals: {
    flows: number;
    pilotReady: number;
    softReady: number;
    fullReady: number;
    blocked: number;
  };
}

export type PromotionViolationCode =
  | 'PROMOTION_STATE_MISSING'
  | 'STAGE_PROGRESSION_INVALID'
  | 'ROLLBACK_INCOMPATIBLE'
  | 'PARITY_DEPENDENCY_MISSING'
  | 'SIMULATION_DEPENDENCY_MISSING'
  | 'OBSERVABILITY_DEPENDENCY_MISSING'
  | 'QUARANTINE_UNSAFE'
  | 'COVERAGE_GAP';

export interface PromotionViolation {
  code: PromotionViolationCode;
  flow?: FlowId;
  detail: string;
}
