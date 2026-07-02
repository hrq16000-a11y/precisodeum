/**
 * Fase 1.7.11 — Atomic Governance types (READ-ONLY).
 *
 * Camada FINAL de governança puramente declarativa. Nenhum write path,
 * nenhuma flag ativa, nenhum rollout/pilot real. Apenas tipos para
 * formalizar decisão, freeze, rollback authority e approval requirements.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';
import type {
  PromotionStageId,
  PromotionConfidence,
} from '@/lib/atomicPromotion/promotionTypes';
import type { AtomicPilotStage, PilotRollbackClass } from '@/lib/atomicPilot/pilotTypes';

export type GovernanceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GovernanceDecision =
  | 'HOLD'
  | 'KEEP_SHADOW'
  | 'ALLOW_INTERNAL_COMPARE'
  | 'ALLOW_PILOT'
  | 'ALLOW_SOFT_ATOMIC'
  | 'ALLOW_FULL_ATOMIC'
  | 'BLOCKED'
  | 'FROZEN';

export type GovernanceFreezeLevel =
  | 'NONE'
  | 'SOFT_FREEZE'
  | 'PARTIAL_FREEZE'
  | 'HARD_FREEZE'
  | 'GLOBAL_FREEZE';

export type GovernanceViolationCode =
  | 'coverage_gap'
  | 'freeze_violation'
  | 'unsafe_promotion'
  | 'forbidden_stage_transition'
  | 'rollback_authority_mismatch'
  | 'missing_approval_requirement'
  | 'live_execution_enabled'
  | 'real_users_enabled'
  | 'retry_enabled'
  | 'rollout_window_violation'
  | 'monotonicity_violation';

export type GovernanceApprovalState =
  | 'not_required'
  | 'required_single_reviewer'
  | 'required_dual_reviewer'
  | 'required_governance_board'
  | 'freeze_locked';

export type GovernanceRollbackAuthority =
  | 'flow_owner'
  | 'release_manager'
  | 'governance_board'
  | 'platform_admin'
  | 'incident_commander';

export type GovernanceChangeClass =
  | 'observability_only'
  | 'shadow_compare'
  | 'cohort_expansion'
  | 'stage_promotion'
  | 'rollback_strategy_change'
  | 'kill_switch_change'
  | 'freeze_override';

export type GovernancePromotionClass =
  | 'frozen'
  | 'shadow_only'
  | 'internal_compare_only'
  | 'pilot_eligible'
  | 'soft_atomic_eligible'
  | 'full_atomic_eligible';

export type GovernanceReleaseWindowState =
  | 'open'
  | 'restricted'
  | 'closed'
  | 'frozen';

export interface GovernanceRiskAssessment {
  flow: FlowId;
  blast: BlastRadiusLevel;
  risk: GovernanceRiskLevel;
  parityScore: number;
  confidence: PromotionConfidence;
  rollbackClass: PilotRollbackClass;
  quarantined: boolean;
  mirrorDependency: boolean;
  conditional: boolean;
  critical: boolean;
}

export interface GovernanceFreezePolicy {
  flow: FlowId;
  level: GovernanceFreezeLevel;
  reasons: string[];
  expiresStage: PromotionStageId | null;
  overrideAuthority: GovernanceRollbackAuthority | null;
  blocksPromotion: boolean;
  blocksRollout: boolean;
}

export interface GovernancePromotionGuard {
  flow: FlowId;
  currentStage: PromotionStageId;
  maxAllowedStage: PromotionStageId;
  promotionClass: GovernancePromotionClass;
  approvalRequired: GovernanceApprovalState;
  liveExecutionEnabled: false;
  realUsersAllowed: false;
  retryEnabled: false;
  backgroundEnabled: false;
}

export interface GovernanceApprovalRequirement {
  flow: FlowId;
  state: GovernanceApprovalState;
  reviewers: number;
  requiresGovernanceBoard: boolean;
  requiresIncidentCommander: boolean;
  rationale: string;
}

export interface GovernanceReleaseWindow {
  flow: FlowId;
  state: GovernanceReleaseWindowState;
  blockedReasons: string[];
  allowedChangeClasses: GovernanceChangeClass[];
  freezeLevel: GovernanceFreezeLevel;
}

export interface AtomicGovernanceState {
  flow: FlowId;
  decision: GovernanceDecision;
  risk: GovernanceRiskAssessment;
  freeze: GovernanceFreezePolicy;
  promotionGuard: GovernancePromotionGuard;
  approval: GovernanceApprovalRequirement;
  releaseWindow: GovernanceReleaseWindow;
  rollbackAuthority: GovernanceRollbackAuthority;
  pilotStage: AtomicPilotStage;
}

export interface GovernanceDecisionMatrix {
  rows: AtomicGovernanceState[];
  totals: {
    flows: number;
    frozen: number;
    blocked: number;
    shadowOnly: number;
    pilotEligible: number;
    fullEligible: number;
    approvalRequired: number;
  };
}

export interface GovernanceViolation {
  code: GovernanceViolationCode;
  flow?: FlowId;
  detail: string;
}

export interface GovernanceAuditEnvelope {
  source: string;
  flow: FlowId;
  decision: GovernanceDecision;
  freeze_level: GovernanceFreezeLevel;
  promotion_class: GovernancePromotionClass;
  approval_state: GovernanceApprovalState;
  rollback_authority: GovernanceRollbackAuthority;
  blast_radius: BlastRadiusLevel;
  risk: GovernanceRiskLevel;
  current_stage: PromotionStageId;
  max_allowed_stage: PromotionStageId;
  live_execution_enabled: false;
  real_users_allowed: false;
}
