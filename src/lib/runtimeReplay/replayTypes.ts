/**
 * Fase 1.8.2 — Runtime Replay Matrix types (READ-ONLY).
 *
 * Reconstrução determinística de execuções históricas. Sem persistência,
 * sem live execution, sem retries/background. Estruturas puramente em
 * memória, usadas para comparar runtimeHistory/runtimeRecorder contra
 * simulation/certification/governance/promotion.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

/* ---------- Enums ---------- */

export type ReplayClassification =
  | 'deterministic'
  | 'partially_deterministic'
  | 'unstable'
  | 'divergent'
  | 'unreconstructable';

export type ReplayPropagation =
  | 'isolated'
  | 'contained'
  | 'cascading'
  | 'recursive'
  | 'circular';

export type ReplayDrift =
  | 'none'
  | 'mirror_only'
  | 'ownership'
  | 'finalize_gap'
  | 'orphaned'
  | 'stale_projection'
  | 'hidden_dependency';

export type ReplayRisk =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type ReplaySeverity =
  | 'NONE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ReplayConfidence =
  | 'UNKNOWN'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'VERY_HIGH';

export type ReplayLineageClass =
  | 'intact'
  | 'mirror_only'
  | 'degraded'
  | 'broken'
  | 'orphaned';

export type ReplayViolationCode =
  | 'missing_replay_flow'
  | 'broken_lineage'
  | 'divergent_ordering'
  | 'unsafe_replay_confidence'
  | 'hidden_replay_dependency'
  | 'recursive_replay_propagation'
  | 'parity_instability'
  | 'live_execution_attempted'
  | 'persistence_attempted'
  | 'retry_attempted'
  | 'background_attempted'
  | 'unsafe_replay_promotion';

/* ---------- Steps + windows ---------- */

export interface ReplayStep {
  readonly step: string;
  readonly order: number;
  readonly mirror: boolean;
  readonly status: 'ok' | 'failed' | 'skipped' | 'aborted';
  readonly logicalTimestamp: number;
}

export interface ReplayWindow {
  readonly flow: FlowId;
  readonly traceIds: readonly string[];
  readonly steps: readonly ReplayStep[];
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly samples: number;
}

/* ---------- Sub-views ---------- */

export interface ReplayConsistency {
  readonly flow: FlowId;
  readonly consistentRatio: number;
  readonly orphanRatio: number;
  readonly inconsistentRatio: number;
  readonly stable: boolean;
}

export interface ReplayParity {
  readonly flow: FlowId;
  readonly score: number; // 0..100 (higher = parity closer to simulation)
  readonly gap: number; // 0..100
  readonly regression: boolean;
  readonly rollbackMismatch: boolean;
  readonly visibilityGap: boolean;
}

export interface ReplayFailurePropagation {
  readonly flow: FlowId;
  readonly propagation: ReplayPropagation;
  readonly affectedSteps: readonly string[];
  readonly cascadeDepth: number;
}

export interface ReplayDeterminism {
  readonly flow: FlowId;
  readonly classification: ReplayClassification;
  readonly orderingStable: boolean;
  readonly outcomeStable: boolean;
  readonly confidence: ReplayConfidence;
  readonly confidenceScore: number; // 0..1
}

export interface ReplayDriftReconstruction {
  readonly flow: FlowId;
  readonly drift: ReplayDrift;
  readonly severity: ReplaySeverity;
  readonly emergenceScore: number; // 0..1
}

export interface ReplayTopology {
  readonly flow: FlowId;
  readonly owners: readonly string[];
  readonly mirrors: readonly string[];
  readonly finalizers: readonly string[];
  readonly onboarding: readonly string[];
  readonly progress: readonly string[];
  readonly avatar: readonly string[];
  readonly admin: readonly string[];
  readonly eventualSync: readonly string[];
  readonly propagation: ReplayPropagation;
  readonly circularDependency: boolean;
  readonly hiddenDependency: boolean;
}

export interface ReplayLineage {
  readonly flow: FlowId;
  readonly class: ReplayLineageClass;
  readonly gaps: readonly string[];
  readonly temporalGap: boolean;
  readonly stateRegression: boolean;
}

export interface RuntimeReplay {
  readonly flow: FlowId;
  readonly window: ReplayWindow;
  readonly determinism: ReplayDeterminism;
  readonly consistency: ReplayConsistency;
  readonly parity: ReplayParity;
  readonly propagation: ReplayFailurePropagation;
  readonly drift: ReplayDriftReconstruction;
  readonly topology: ReplayTopology;
  readonly lineage: ReplayLineage;
  readonly classification: ReplayClassification;
  readonly risk: ReplayRisk;
  readonly severity: ReplaySeverity;
  readonly confidence: ReplayConfidence;
  // Hard invariants — sempre falsos na fase 1.8.x.
  readonly liveExecutionEnabled: false;
  readonly realUsersAllowed: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface ReplayViolation {
  readonly flow: FlowId | 'GLOBAL';
  readonly code: ReplayViolationCode;
  readonly detail: string;
}
