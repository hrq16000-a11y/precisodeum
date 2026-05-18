/**
 * Fase 1.7.7 — Atomic Simulation + Divergence types (READ-ONLY).
 *
 * Modelagem 100% determinística. Sem supabase, sem fetch, sem timers,
 * sem runtime mutável. Apenas tipos + literais estáveis.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  AtomicRiskLevel,
  RollbackStrategyId,
  ConsistencyLevel,
} from '@/lib/atomicBlueprint/atomicBlueprintTypes';

export type DivergenceSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DivergenceKind =
  | 'field'
  | 'ownership'
  | 'mirror'
  | 'finalize'
  | 'onboarding'
  | 'topology'
  | 'rollback'
  | 'observability';

export type BlastRadiusLevel = AtomicRiskLevel;

export type MigrationConfidence =
  | 'NOT_READY'
  | 'EXPERIMENTAL'
  | 'CONTROLLED'
  | 'SAFE_FOR_SHADOW'
  | 'READY_FOR_SOFT_ATOMIC';

export type FailurePoint =
  | 'profile_write'
  | 'provider_write'
  | 'service_write'
  | 'avatar_write'
  | 'finalize'
  | 'progress_sync'
  | 'mirror_sync'
  | 'tracker'
  | 'observer';

export type FailurePropagationKind =
  | 'cascading'
  | 'mirror_amplification'
  | 'admin_amplification'
  | 'onboarding_amplification'
  | 'drift_amplification'
  | 'orphan_propagation'
  | 'stale_read_propagation';

export type SimulationViolationCode =
  | 'SIMULATION_MISSING'
  | 'PARITY_GAP'
  | 'ROLLBACK_UNSAFE'
  | 'BLAST_RADIUS_UNKNOWN'
  | 'CONFIDENCE_INVALID'
  | 'DIVERGENCE_UNCLASSIFIED'
  | 'FAILURE_PROPAGATION_UNKNOWN';

export interface SimulationViolation {
  code: SimulationViolationCode;
  flow?: FlowId;
  detail: string;
}

export interface ExecutionPlanStep {
  step: string;
  atomic: boolean;
  /** safe to retry in isolation after partial failure */
  safeRetry: boolean;
  /** logical visibility window after this step */
  visibility: 'private' | 'partial' | 'public';
}

export interface SimulatedExecutionPlan {
  flow: FlowId;
  steps: ExecutionPlanStep[];
  /** final expected state at end of plan */
  finalState: 'consistent' | 'eventually_consistent' | 'divergent';
  rollback: RollbackStrategyId;
  consistency: ConsistencyLevel[];
}

export interface SimulationResult {
  flow: FlowId;
  legacy: SimulatedExecutionPlan;
  atomic: SimulatedExecutionPlan;
  expectedFinalState: 'consistent' | 'eventually_consistent';
  rollbackVisibility: 'none' | 'partial' | 'full';
  compensationRequirements: string[];
  mirrorPropagation: boolean;
  eventualWindows: string[];
  dependencyOrder: string[];
  failurePoints: FailurePoint[];
}

export interface DivergenceEntry {
  kind: DivergenceKind;
  severity: DivergenceSeverity;
  detail: string;
}

export interface DivergenceReport {
  flow: FlowId;
  entries: DivergenceEntry[];
  worst: DivergenceSeverity;
}

export interface ParityResult {
  flow: FlowId;
  orderParity: boolean;
  resultParity: boolean;
  sideEffectParity: boolean;
  rollbackParity: boolean;
  visibilityParity: boolean;
  consistencyParity: boolean;
  /** 0..100 */
  score: number;
  regressions: string[];
}

export interface RollbackSimulationCase {
  scenario:
    | 'provider_fail_after_profile'
    | 'finalize_fail_after_service'
    | 'mirror_fail'
    | 'tracker_fail'
    | 'drift_emergence'
    | 'eventual_sync_lag';
  feasible: boolean;
  compensationPath: string[];
  visibilityLeak: boolean;
  orphanRisk: boolean;
  reconciliationComplexity: AtomicRiskLevel;
}

export interface RollbackSimulationReport {
  flow: FlowId;
  cases: RollbackSimulationCase[];
}

export interface BlastRadiusReport {
  flow: FlowId;
  tables: string[];
  boundaries: string[];
  ownershipCoupling: boolean;
  mirrorCoupling: boolean;
  adminExposure: boolean;
  onboardingExposure: boolean;
  driftAmplification: boolean;
  observabilityDependency: boolean;
  rollbackComplexity: AtomicRiskLevel;
  level: BlastRadiusLevel;
}

export interface MigrationConfidenceReport {
  flow: FlowId;
  testCoverage: number;
  invariantCoverage: number;
  boundaryCoverage: number;
  rollbackCoverage: number;
  parity: number;
  driftRisk: AtomicRiskLevel;
  coupling: AtomicRiskLevel;
  topologySafety: AtomicRiskLevel;
  legacyIsolation: boolean;
  /** 0..100 */
  score: number;
  confidence: MigrationConfidence;
}

export interface ShadowComparisonReport {
  flow: FlowId;
  legacyPlan: SimulatedExecutionPlan;
  atomicPlan: SimulatedExecutionPlan;
  missingSteps: string[];
  unsafeReorder: boolean;
  hiddenDependencies: string[];
  unsafeMirror: boolean;
  finalizeMismatch: boolean;
  trackerMismatch: boolean;
}

export interface FailurePropagationReport {
  flow: FlowId;
  cascades: FailurePropagationKind[];
  amplifiedBy: FailurePropagationKind[];
  orphanRisk: boolean;
  staleReadRisk: boolean;
}
