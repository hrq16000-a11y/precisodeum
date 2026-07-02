/**
 * Fase 1.7.10 — Atomic Pilot Planning types (READ-ONLY).
 *
 * Camada puramente declarativa. Nenhum write path real, nenhuma flag
 * ativa, nenhuma rollout real. Apenas tipos e estruturas para
 * formalizar o plano do primeiro piloto atômico.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';
import type {
  PromotionConfidence,
  PromotionStageId,
} from '@/lib/atomicPromotion/promotionTypes';
import type { RollbackStrategyId } from '@/lib/atomicBlueprint/atomicBlueprintTypes';

export type AtomicPilotStage =
  | 'STAGE_0_DISABLED'
  | 'STAGE_1_INTERNAL_SHADOW'
  | 'STAGE_2_INTERNAL_COMPARE'
  | 'STAGE_3_SAFE_COHORT'
  | 'STAGE_4_LIMITED_PRODUCTION'
  | 'STAGE_5_FULL_PROMOTION';

export type PilotEligibility =
  | 'NOT_ELIGIBLE'
  | 'CONDITIONAL'
  | 'READY'
  | 'BLOCKED';

export type PilotRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type PilotRollbackClass =
  | 'incompatible'
  | 'compensation_required'
  | 'safe_retry'
  | 'noop'
  | 'hard_abort';

export type PilotAbortReason =
  | 'parity_regression'
  | 'rollback_failure'
  | 'drift_explosion'
  | 'blast_escalation'
  | 'orphan_emergence'
  | 'stale_read_spike'
  | 'mirror_inconsistency'
  | 'unsafe_promotion'
  | 'observability_gap'
  | 'manual_kill_switch';

export type PilotKillSwitch =
  | 'parity_regression'
  | 'rollback_failure'
  | 'drift_explosion'
  | 'blast_escalation'
  | 'orphan_emergence'
  | 'stale_read_spike'
  | 'mirror_inconsistency'
  | 'unsafe_promotion';

export type PilotCohort =
  | 'internal_only'
  | 'low_risk_users'
  | 'non_provider_only'
  | 'provider_shadow_only'
  | 'admin_only'
  | 'isolated_region'
  | 'safe_boundary_only';

export type PilotObservabilityLevel =
  | 'NONE'
  | 'MINIMAL'
  | 'STANDARD'
  | 'HIGH'
  | 'FULL';

export type PilotPromotionPolicy =
  | 'manual_only'
  | 'staged_internal'
  | 'staged_safe_cohort'
  | 'staged_progressive'
  | 'frozen';

export type PilotExecutionMode =
  | 'read_only'
  | 'shadow'
  | 'compare'
  | 'cohort'
  | 'limited'
  | 'full';

export type PilotDecision =
  | 'HOLD'
  | 'KEEP_SHADOW'
  | 'ADVANCE_INTERNAL_COMPARE'
  | 'ADVANCE_SAFE_COHORT'
  | 'ADVANCE_LIMITED_PRODUCTION'
  | 'ADVANCE_FULL_PROMOTION'
  | 'BLOCKED';

export type PilotViolationCode =
  | 'unsafe_pilot_candidate'
  | 'missing_kill_switch'
  | 'missing_abort_strategy'
  | 'insufficient_parity'
  | 'unsafe_rollout'
  | 'missing_observability'
  | 'quarantined_flow'
  | 'critical_blast_radius'
  | 'unsafe_cohort'
  | 'live_execution_dependency';

export interface PilotSafetyProfile {
  flow: FlowId;
  rollback: PilotRollbackClass;
  rollbackStrategy: RollbackStrategyId | null;
  risk: PilotRiskLevel;
  blast: BlastRadiusLevel;
  parityScore: number;
  driftSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mirrorDependency: boolean;
  quarantined: boolean;
}

export interface PilotRolloutStrategy {
  flow: FlowId;
  policy: PilotPromotionPolicy;
  percentage: number; // declarative; never applied
  cohorts: PilotCohort[];
  progressiveExposure: boolean;
  shadowCompareRequired: boolean;
  mirrorValidationRequired: boolean;
  driftTolerance: 'ZERO' | 'LOW' | 'MEDIUM';
}

export interface PilotAbortStrategy {
  flow: FlowId;
  triggers: PilotAbortReason[];
  immediate: boolean;
  graceful: boolean;
  shadowFallback: boolean;
  mirrorDisable: boolean;
  pilotFreeze: boolean;
}

export interface PilotObservabilityProfile {
  flow: FlowId;
  level: PilotObservabilityLevel;
  parityTracking: boolean;
  rollbackVisibility: boolean;
  driftTelemetry: boolean;
  mirrorTelemetry: boolean;
  blastMonitoring: boolean;
  boundaryTracking: boolean;
  executionTraceability: boolean;
  coverage: number; // 0..100
}

export interface PilotExecutionConstraints {
  flow: FlowId;
  mode: PilotExecutionMode;
  liveExecutionEnabled: false; // permanently locked in this phase
  realUsersAllowed: false; // permanently locked
  shadowOnly: true;
  requiresPromotionApproval: true;
}

export interface PilotKillSwitchPolicy {
  flow: FlowId;
  triggers: PilotKillSwitch[];
  sensitivity: PilotRiskLevel;
  autoEngage: false; // never auto-engages in shadow phase
}

export interface AtomicPilotCandidate {
  flow: FlowId;
  eligibility: PilotEligibility;
  recommendedStage: AtomicPilotStage;
  risk: PilotRiskLevel;
  blast: BlastRadiusLevel;
  parityScore: number;
  confidence: PromotionConfidence;
  promotion: PromotionStageId;
  rollback: PilotRollbackClass;
  blockerCount: number;
  rationale: string;
}

export interface AtomicPilotPlan {
  flow: FlowId;
  candidate: AtomicPilotCandidate;
  safety: PilotSafetyProfile;
  rollout: PilotRolloutStrategy;
  abort: PilotAbortStrategy;
  observability: PilotObservabilityProfile;
  execution: PilotExecutionConstraints;
  killSwitch: PilotKillSwitchPolicy;
  decision: PilotDecision;
}

export interface PilotMatrixRow {
  flow: FlowId;
  eligible: boolean;
  recommendedStage: AtomicPilotStage;
  rolloutClass: PilotPromotionPolicy;
  rollbackClass: PilotRollbackClass;
  observabilityLevel: PilotObservabilityLevel;
  blastRadius: BlastRadiusLevel;
  promotionStage: PromotionStageId;
  cohort: PilotCohort;
  abortSensitivity: PilotRiskLevel;
  decision: PilotDecision;
}

export interface PilotMatrix {
  rows: PilotMatrixRow[];
  totals: {
    flows: number;
    ready: number;
    conditional: number;
    blocked: number;
    notEligible: number;
  };
}

export interface PilotViolation {
  code: PilotViolationCode;
  flow?: FlowId;
  detail: string;
}
