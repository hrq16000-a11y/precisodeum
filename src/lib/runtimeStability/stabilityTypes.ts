/**
 * Fase 1.8.4 — Runtime Stability types (READ-ONLY).
 *
 * Estruturas puras, em memória, para descrever estabilidade estrutural,
 * envelopes de propagação e pontos de colapso operacional sobre dados
 * já observados. Sem persistência, sem live execution, sem retries.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

/* ---------- Enums ---------- */

export type StabilityClassification =
  | 'stable'
  | 'converging'
  | 'unstable'
  | 'collapsing'
  | 'divergent';

export type DependencyResolution =
  | 'resolved'
  | 'partially_resolved'
  | 'unresolved'
  | 'hidden'
  | 'circular';

export type CollapseSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type ConvergenceMode =
  | 'deterministic'
  | 'eventual'
  | 'delayed'
  | 'recursive'
  | 'divergent';

export type PropagationEnvelopeKind =
  | 'owner'
  | 'mirrors'
  | 'finalize'
  | 'onboarding'
  | 'progress'
  | 'avatar'
  | 'admin'
  | 'replay'
  | 'eventual_sync';

export type StabilityViolationCode =
  | 'unresolved_dependency'
  | 'circular_dependency_leak'
  | 'propagation_overflow'
  | 'collapse_uncontained'
  | 'convergence_divergence'
  | 'hidden_dependency_expansion'
  | 'unsafe_stability_escalation'
  | 'isolation_boundary_leak'
  | 'observability_pii_leak'
  | 'live_execution_attempted'
  | 'retry_attempted'
  | 'background_attempted';

export interface RuntimeStabilityViolation {
  readonly flow: FlowId;
  readonly code: StabilityViolationCode;
  readonly detail: string;
}

/* ---------- Core structures ---------- */

export interface RuntimeDependencyNode {
  readonly flow: FlowId;
  readonly step: string;
  readonly kind: 'owner' | 'mirror' | 'finalize' | 'replay' | 'projection';
  readonly resolved: boolean;
  readonly hidden: boolean;
}

export interface RuntimeDependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly weight: number;
  readonly circular: boolean;
  readonly hidden: boolean;
}

export interface RuntimeDependencyResolution {
  readonly flow: FlowId;
  readonly resolution: DependencyResolution;
  readonly nodes: readonly RuntimeDependencyNode[];
  readonly edges: readonly RuntimeDependencyEdge[];
  readonly depth: number;
  readonly unresolvedCount: number;
  readonly hiddenCount: number;
  readonly circular: boolean;
}

export interface RuntimeCollapsePoint {
  readonly flow: FlowId;
  readonly step: string;
  readonly severity: CollapseSeverity;
  readonly blastRadius: number;
  readonly cascade: boolean;
  readonly origin: 'mirror' | 'finalize' | 'replay' | 'temporal' | 'owner';
}

export interface RuntimeIsolationBoundary {
  readonly flow: FlowId;
  readonly intact: boolean;
  readonly leakedTo: readonly FlowId[];
}

export interface RuntimePropagationEnvelope {
  readonly flow: FlowId;
  readonly kind: PropagationEnvelopeKind;
  readonly depth: number;
  readonly overflow: boolean;
  readonly recursive: boolean;
  readonly boundaryLeak: boolean;
}

export interface RuntimeConvergenceState {
  readonly flow: FlowId;
  readonly mode: ConvergenceMode;
  readonly confidence: number; // 0..1
  readonly delayMs: number;
  readonly divergent: boolean;
  readonly regressed: boolean;
}

export interface RuntimeStabilityWindow {
  readonly flow: FlowId;
  readonly sampledTraces: number;
  readonly stableTraces: number;
  readonly unstableTraces: number;
  readonly classification: StabilityClassification;
}

export interface RuntimeStabilityEnvelope {
  readonly flow: FlowId;
  readonly classification: StabilityClassification;
  readonly score: number; // 0..1
  readonly resolution: RuntimeDependencyResolution;
  readonly collapse: readonly RuntimeCollapsePoint[];
  readonly propagation: readonly RuntimePropagationEnvelope[];
  readonly isolation: RuntimeIsolationBoundary;
  readonly convergence: RuntimeConvergenceState;
  readonly window: RuntimeStabilityWindow;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface RuntimeStabilityHealth {
  readonly flows: number;
  readonly stable: number;
  readonly converging: number;
  readonly unstable: number;
  readonly collapsing: number;
  readonly divergent: number;
  readonly averageScore: number;
  readonly worstCollapseSeverity: CollapseSeverity;
}

export interface RuntimeResolutionSummary {
  readonly flow: FlowId;
  readonly resolution: DependencyResolution;
  readonly unresolvedCount: number;
  readonly hiddenCount: number;
  readonly depth: number;
}
