/**
 * Fase 1.7.9 — RPC Contract Specification types (READ-ONLY).
 *
 * Modelagem 100% determinística. Sem supabase, sem timers, sem write paths.
 * Apenas tipos e enums estáveis para declarar contratos das RPCs futuras.
 *
 * NENHUMA RPC real é criada por esta camada — somente contratos formais.
 */

import type { FlowId, BoundaryId } from '@/lib/operations/operationRegistry';
import type {
  AtomicRiskLevel,
  RollbackStrategyId,
  ConsistencyLevel,
} from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';
import type {
  PromotionStageId,
  PromotionConfidence,
} from '@/lib/atomicPromotion/promotionTypes';

export type RpcStrength = 'NONE' | 'WEAK' | 'PARTIAL' | 'STRONG' | 'FULL';

export type RpcCompatibilityLevel = RpcStrength;

export type RpcAtomicityLevel =
  | 'none'
  | 'partial'
  | 'transactional'
  | 'fully_atomic';

export type RpcExecutionSemantic =
  | 'shadow_only'
  | 'dry_run'
  | 'pilot_gated'
  | 'soft_atomic'
  | 'full_atomic';

export type RpcFailureClass =
  | 'transient'
  | 'invariant_violation'
  | 'ownership_conflict'
  | 'idempotency_violation'
  | 'rollback_required'
  | 'fatal';

export type RpcRetryPolicyKind =
  | 'no_retry'
  | 'safe_retry'
  | 'compensating_retry'
  | 'manual_only';

export type RpcSideEffectKind =
  | 'navigation'
  | 'toast'
  | 'analytics'
  | 'audit_log'
  | 'mirror_sync'
  | 'draft_cleanup'
  | 'onboarding_progress'
  | 'avatar_propagation';

export type RpcSideEffectForbidden =
  | 'hidden_retry'
  | 'silent_mutation'
  | 'recursive_finalize'
  | 'cross_flow_mutation'
  | 'implicit_ownership_reassignment';

export type RpcContractViolationCode =
  | 'missing_rollback_contract'
  | 'missing_idempotency'
  | 'unsafe_side_effect'
  | 'incompatible_boundary'
  | 'weak_consistency'
  | 'unsafe_payload'
  | 'missing_promotion_support'
  | 'rpc_not_shadow_ready';

export type RpcPayloadFieldKind =
  | 'identifier'
  | 'ownership'
  | 'scalar'
  | 'enum'
  | 'json_bounded'
  | 'json_unbounded'
  | 'raw_payload'
  | 'timestamp';

export interface RpcPayloadField {
  name: string;
  kind: RpcPayloadFieldKind;
  required: boolean;
  canonicalOwner?: 'profile' | 'provider' | 'admin' | 'mixed';
  notes?: string;
}

export interface RpcPayloadSchema {
  flow: FlowId;
  name: string;
  fields: RpcPayloadField[];
  forbiddenFields: string[];
  unsafeFieldsDetected: string[];
  canonicalOwner: 'profile' | 'provider' | 'admin' | 'mixed';
}

export interface RpcRollbackContract {
  flow: FlowId;
  strategy: RollbackStrategyId;
  classification:
    | 'none'
    | 'weak'
    | 'compensating'
    | 'retry_safe'
    | 'transactional_ready';
  strength: RpcStrength;
  requiresCompensation: boolean;
  supportsSafeRetry: boolean;
  supportsVisibilityRevert: boolean;
}

export interface RpcIdempotencyContract {
  flow: FlowId;
  /** key inputs used to dedupe a replay */
  replayKeys: string[];
  deterministicReplay: boolean;
  requiresReplayProtection: boolean;
  nonIdempotentRisks: string[];
}

export interface RpcConsistencyGuarantee {
  flow: FlowId;
  level: ConsistencyLevel[];
  strength: RpcStrength;
  requiresMirrorPropagation: boolean;
  requiresOwnershipResolution: boolean;
  supportsEventualConsistency: boolean;
}

export interface RpcSideEffectPolicy {
  flow: FlowId;
  allowed: RpcSideEffectKind[];
  forbidden: RpcSideEffectForbidden[];
}

export interface RpcRetryPolicy {
  flow: FlowId;
  kind: RpcRetryPolicyKind;
  /** machine + human classification of failures */
  failureClasses: RpcFailureClass[];
  allowsClientRetry: boolean;
  allowsBackgroundRetry: boolean;
}

export interface RpcPromotionCompatibility {
  flow: FlowId;
  minStage: PromotionStageId;
  maxStage: PromotionStageId;
  requiredConfidence: PromotionConfidence;
  pilotReady: boolean;
  softReady: boolean;
  fullReady: boolean;
}

export interface RpcContract {
  rpc: string;
  flow: FlowId;
  boundaries: BoundaryId[];
  ownership: 'profile' | 'provider' | 'admin' | 'mixed';
  requiredBuilders: string[];
  requiredTrackers: string[];
  payload: RpcPayloadSchema;
  rollback: RpcRollbackContract;
  idempotency: RpcIdempotencyContract;
  consistency: RpcConsistencyGuarantee;
  sideEffects: RpcSideEffectPolicy;
  retry: RpcRetryPolicy;
  promotion: RpcPromotionCompatibility;
  atomicity: RpcAtomicityLevel;
  executionSemantic: RpcExecutionSemantic;
  mirrorPropagation: boolean;
  driftSensitivity: AtomicRiskLevel;
  compatibility: RpcCompatibilityLevel;
  /** read-only flag — sempre false nesta fase */
  liveExecutionEnabled: false;
}

export interface RpcReadinessReport {
  rpc: string;
  flow: FlowId;
  parityScore: number;
  blastRadius: BlastRadiusLevel;
  promotion: PromotionStageId;
  rollbackOk: boolean;
  idempotencyOk: boolean;
  consistencyOk: boolean;
  payloadOk: boolean;
  blockers: { code: RpcContractViolationCode; detail: string }[];
  readinessScore: number;
  confidence: PromotionConfidence;
  shadowReady: boolean;
  pilotReady: boolean;
}

export interface RpcCompatibilityRow {
  rpc: string;
  flow: FlowId;
  boundaries: BoundaryId[];
  builders: string[];
  promotionStage: PromotionStageId;
  rollback: RollbackStrategyId;
  driftSensitivity: AtomicRiskLevel;
  liveGateOpen: false;
  compatibility: RpcCompatibilityLevel;
}

export interface RpcContractViolation {
  code: RpcContractViolationCode;
  rpc?: string;
  flow?: FlowId;
  detail: string;
}
