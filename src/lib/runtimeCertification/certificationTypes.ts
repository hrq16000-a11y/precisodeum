/**
 * Fase 1.7.12 — Runtime Certification types (READ-ONLY).
 *
 * Camada FINAL de certificação operacional. 100% declarativa.
 * Nenhum write path real, nenhuma flag ativa, nenhuma execução real.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';
import type {
  PromotionConfidence,
  PromotionStageId,
} from '@/lib/atomicPromotion/promotionTypes';
import type { PilotRollbackClass } from '@/lib/atomicPilot/pilotTypes';
import type {
  GovernanceDecision,
  GovernanceFreezeLevel,
} from '@/lib/atomicGovernance/governanceTypes';

export type RuntimeCertificationLevel =
  | 'NONE'
  | 'LIMITED'
  | 'CONDITIONAL'
  | 'FULL';

export type RuntimeCertificationDecision =
  | 'BLOCKED'
  | 'SHADOW_ONLY'
  | 'INTERNAL_COMPARE'
  | 'LIMITED_CERTIFIED'
  | 'CONDITIONAL_CERTIFIED'
  | 'FULL_CERTIFIED';

export type RuntimeCertificationRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RuntimeCertificationViolationCode =
  | 'coverage_gap'
  | 'unsafe_certification_promotion'
  | 'parity_certification_mismatch'
  | 'rollback_certification_unsafe'
  | 'observability_certification_gap'
  | 'drift_certification_unbounded'
  | 'isolation_certification_unsafe'
  | 'execution_certification_unsafe'
  | 'live_execution_enabled'
  | 'real_users_enabled'
  | 'retry_enabled'
  | 'background_enabled'
  | 'illegal_full_certification'
  | 'monotonicity_violation';

export type RuntimeCertificationClass =
  | 'frozen'
  | 'shadow_only'
  | 'internal_compare_only'
  | 'limited_certified'
  | 'conditional_certified'
  | 'full_certified';

export type RuntimeExecutionClass =
  | 'inert'
  | 'shadow'
  | 'compare'
  | 'limited'
  | 'conditional'
  | 'full';

export type RuntimeIsolationClass =
  | 'unsafe'
  | 'partial'
  | 'boundary_isolated'
  | 'strict_isolated';

export type RuntimeRollbackClass =
  | 'incompatible'
  | 'compensation_required'
  | 'safe_retry'
  | 'noop'
  | 'hard_abort';

export interface RuntimeExecutionCertification {
  flow: FlowId;
  isolation: RuntimeIsolationClass;
  determinism: boolean;
  ordering: boolean;
  rollback: RuntimeRollbackClass;
  parityOk: boolean;
  executionClass: RuntimeExecutionClass;
  safety: RuntimeCertificationLevel;
}

export interface RuntimeIsolationCertification {
  flow: FlowId;
  boundary: string;
  ownershipCoupling: boolean;
  mirrorCoupling: boolean;
  adminExposure: boolean;
  isolation: RuntimeIsolationClass;
  safe: boolean;
}

export interface RuntimeRollbackCertification {
  flow: FlowId;
  rollback: RuntimeRollbackClass;
  consistencyOk: boolean;
  dependencyOk: boolean;
  unsafeDependencies: string[];
  level: RuntimeCertificationLevel;
}

export interface RuntimeParityCertification {
  flow: FlowId;
  score: number; // 0..100
  confidence: PromotionConfidence;
  stable: boolean;
  regressions: string[];
  rollbackParityOk: boolean;
  level: RuntimeCertificationLevel;
}

export interface RuntimeObservabilityCertification {
  flow: FlowId;
  coverage: number; // 0..100
  gaps: string[];
  confidence: PromotionConfidence;
  level: RuntimeCertificationLevel;
}

export interface RuntimeDriftCertification {
  flow: FlowId;
  contained: boolean;
  unbounded: boolean;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  level: RuntimeCertificationLevel;
}

export interface RuntimeCertificationState {
  flow: FlowId;
  decision: RuntimeCertificationDecision;
  certificationClass: RuntimeCertificationClass;
  level: RuntimeCertificationLevel;
  risk: RuntimeCertificationRisk;
  blast: BlastRadiusLevel;
  freeze: GovernanceFreezeLevel;
  governance: GovernanceDecision;
  currentStage: PromotionStageId;
  maxAllowedStage: PromotionStageId;
  execution: RuntimeExecutionCertification;
  isolation: RuntimeIsolationCertification;
  rollback: RuntimeRollbackCertification;
  parity: RuntimeParityCertification;
  observability: RuntimeObservabilityCertification;
  drift: RuntimeDriftCertification;
  rollbackClass: PilotRollbackClass;
  liveExecutionEnabled: false;
  realUsersAllowed: false;
  retryEnabled: false;
  backgroundEnabled: false;
}

export interface RuntimeCertificationMatrix {
  rows: RuntimeCertificationState[];
  totals: {
    flows: number;
    blocked: number;
    shadowOnly: number;
    limited: number;
    conditional: number;
    full: number;
  };
}

export interface RuntimeCertificationViolation {
  code: RuntimeCertificationViolationCode;
  flow?: FlowId;
  detail: string;
}

export interface RuntimeCertificationEnvelope {
  source: string;
  flow: FlowId;
  decision: RuntimeCertificationDecision;
  level: RuntimeCertificationLevel;
  certification_class: RuntimeCertificationClass;
  execution_class: RuntimeExecutionClass;
  isolation_class: RuntimeIsolationClass;
  rollback_class: RuntimeRollbackClass;
  risk: RuntimeCertificationRisk;
  blast_radius: BlastRadiusLevel;
  freeze_level: GovernanceFreezeLevel;
  current_stage: PromotionStageId;
  max_allowed_stage: PromotionStageId;
  parity_score: number;
  observability_coverage: number;
  drift_contained: boolean;
  live_execution_enabled: false;
  real_users_allowed: false;
  retry_enabled: false;
  background_enabled: false;
}
