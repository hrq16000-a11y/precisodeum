/**
 * Fase 1.8.6 — Runtime Isolation types (READ-ONLY).
 * Estruturas puras, em memória, para certificação de isolamento entre runtime layers.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

/* ---------- Enums ---------- */

export type IsolationClassification =
  | 'FULLY_ISOLATED'
  | 'CONTAINED'
  | 'BOUNDARY_SHARED'
  | 'LEAKING'
  | 'COLLAPSED';

export type IsolationBoundaryType =
  | 'RUNTIME'
  | 'DRIFT'
  | 'SIMULATION'
  | 'PROMOTION'
  | 'CERTIFICATION'
  | 'GOVERNANCE'
  | 'REPLAY'
  | 'CAUSALITY'
  | 'STABILITY'
  | 'INTEGRITY';

export type IsolationLeakType =
  | 'cross_layer_dependency'
  | 'recursive_propagation'
  | 'shared_boundary'
  | 'unsafe_lineage'
  | 'hidden_cascade'
  | 'topology_overlap'
  | 'unbounded_propagation';

export type IsolationSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IsolationPropagationClassification =
  | 'isolated'
  | 'contained'
  | 'shared'
  | 'leaking'
  | 'collapsed';

export type IsolationViolationCode =
  | 'ISOLATION_LEAK_EXPANSION'
  | 'BOUNDARY_COLLAPSE'
  | 'UNSAFE_TOPOLOGY_OVERLAP'
  | 'LIVE_EXECUTION_DETECTED'
  | 'REAL_USER_ENABLEMENT'
  | 'BACKGROUND_ACTIVITY_DETECTED'
  | 'NON_DETERMINISTIC_ISOLATION'
  | 'ISOLATION_COVERAGE_GAP'
  | 'CERTIFICATION_INTEGRITY_GAP'
  | 'OBSERVABILITY_PII_LEAK';

/* ---------- Core structures ---------- */

export interface IsolationBoundary {
  readonly flow: FlowId;
  readonly type: IsolationBoundaryType;
  readonly intact: boolean;
  readonly sharedWith: readonly IsolationBoundaryType[];
}

export interface IsolationLeak {
  readonly flow: FlowId;
  readonly type: IsolationLeakType;
  readonly severity: IsolationSeverity;
  readonly boundaries: readonly IsolationBoundaryType[];
  readonly detail: string;
}

export interface IsolationPropagation {
  readonly flow: FlowId;
  readonly classification: IsolationPropagationClassification;
  readonly depth: number;
  readonly unbounded: boolean;
  readonly hiddenCascade: boolean;
}

export interface IsolationTopology {
  readonly flow: FlowId;
  readonly boundaries: readonly IsolationBoundary[];
  readonly overlaps: number;
  readonly recursive: boolean;
  readonly unsafeCoupling: boolean;
}

export interface IsolationEnvelope {
  readonly flow: FlowId;
  readonly classification: IsolationClassification;
  readonly severity: IsolationSeverity;
  readonly score: number; // 0..1
  readonly topology: IsolationTopology;
  readonly leaks: readonly IsolationLeak[];
  readonly propagation: IsolationPropagation;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface IsolationMatrix {
  readonly envelopes: readonly IsolationEnvelope[];
  readonly generatedAt: number;
}

export interface IsolationAggregation {
  readonly flows: number;
  readonly fullyIsolated: number;
  readonly contained: number;
  readonly boundaryShared: number;
  readonly leaking: number;
  readonly collapsed: number;
  readonly averageScore: number;
  readonly worstSeverity: IsolationSeverity;
}

export interface IsolationCertification {
  readonly flow: FlowId;
  readonly certified: boolean;
  readonly confidence: number; // 0..1
  readonly classification: IsolationClassification;
  readonly severity: IsolationSeverity;
  readonly reasons: readonly string[];
}

export interface IsolationViolation {
  readonly flow: FlowId;
  readonly code: IsolationViolationCode;
  readonly detail: string;
}
