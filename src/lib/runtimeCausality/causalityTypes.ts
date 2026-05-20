/**
 * Fase 1.8.3 — Runtime Causality Graph types (READ-ONLY).
 *
 * Estruturas puras, em memória, para descrever causalidade operacional
 * sobre traces já observados. Sem persistência, sem live execution,
 * sem retries/background. 100% determinístico.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

/* ---------- Enums ---------- */

export type CausalityStrength = 'none' | 'weak' | 'moderate' | 'strong' | 'critical';

export type CausalityClassification =
  | 'isolated'
  | 'dependent'
  | 'cascading'
  | 'recursive'
  | 'circular'
  | 'hidden';

export type FailureOrigin =
  | 'owner_missing'
  | 'mirror_desync'
  | 'finalize_gap'
  | 'ordering_violation'
  | 'replay_divergence'
  | 'parity_gap'
  | 'stale_projection'
  | 'hidden_dependency'
  | 'drift_escalation'
  | 'orphan_state';

export type PropagationMode =
  | 'direct'
  | 'indirect'
  | 'delayed'
  | 'eventual'
  | 'recursive'
  | 'circular';

export type CausalitySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CausalityViolationCode =
  | 'missing_causality_flow'
  | 'hidden_dependency_unbounded'
  | 'recursive_cascade'
  | 'circular_cascade'
  | 'replay_causality_divergence'
  | 'unsafe_blast_escalation'
  | 'drift_uncontained'
  | 'live_execution_attempted'
  | 'persistence_attempted'
  | 'retry_attempted'
  | 'background_attempted'
  | 'unsafe_causality_promotion'
  | 'observability_pii_leak';

/* ---------- Graph ---------- */

export interface RuntimeCausalityNode {
  readonly id: string;
  readonly flow: FlowId;
  readonly step: string;
  readonly mirror: boolean;
  readonly failure: boolean;
}

export interface RuntimeCausalityEdge {
  readonly from: string;
  readonly to: string;
  readonly strength: CausalityStrength;
  readonly mode: PropagationMode;
  readonly hidden: boolean;
}

export interface RuntimeCausalityChain {
  readonly flow: FlowId;
  readonly path: readonly string[];
  readonly classification: CausalityClassification;
  readonly depth: number;
}

export interface RuntimeFailureCause {
  readonly flow: FlowId;
  readonly origin: FailureOrigin;
  readonly step: string;
  readonly strength: CausalityStrength;
}

export interface RuntimePropagationCause {
  readonly flow: FlowId;
  readonly mode: PropagationMode;
  readonly depth: number;
  readonly affectedSteps: readonly string[];
}

export interface RuntimeTemporalCause {
  readonly flow: FlowId;
  readonly escalating: boolean;
  readonly samples: number;
  readonly windowDepth: number;
}

export interface RuntimeMirrorCause {
  readonly flow: FlowId;
  readonly desynced: boolean;
  readonly mirrorSteps: readonly string[];
}

export interface RuntimeOrderingCause {
  readonly flow: FlowId;
  readonly violated: boolean;
  readonly violations: readonly string[];
}

export interface RuntimeReplayCause {
  readonly flow: FlowId;
  readonly divergent: boolean;
  readonly unstable: boolean;
  readonly regression: boolean;
}

export interface RuntimeDriftCause {
  readonly flow: FlowId;
  readonly escalating: boolean;
  readonly unbounded: boolean;
  readonly containmentScore: number; // 0..1 (higher = more contained)
}

export interface RuntimeBlastCause {
  readonly flow: FlowId;
  readonly escalated: boolean;
  readonly impactedFlows: readonly FlowId[];
}

export interface RuntimeCausalityTopology {
  readonly flow: FlowId;
  readonly owners: readonly string[];
  readonly mirrors: readonly string[];
  readonly finalizers: readonly string[];
  readonly onboarding: readonly string[];
  readonly progress: readonly string[];
  readonly avatar: readonly string[];
  readonly admin: readonly string[];
  readonly replay: readonly string[];
  readonly eventualSync: readonly string[];
  readonly cycles: boolean;
  readonly hiddenDependencies: boolean;
  readonly risk: CausalitySeverity;
}

export interface RuntimeCausalityGraph {
  readonly flow: FlowId;
  readonly nodes: readonly RuntimeCausalityNode[];
  readonly edges: readonly RuntimeCausalityEdge[];
  readonly chains: readonly RuntimeCausalityChain[];
  readonly classification: CausalityClassification;
  readonly strength: CausalityStrength;
  readonly severity: CausalitySeverity;
  readonly failureCauses: readonly RuntimeFailureCause[];
  readonly propagation: RuntimePropagationCause;
  readonly temporal: RuntimeTemporalCause;
  readonly mirror: RuntimeMirrorCause;
  readonly ordering: RuntimeOrderingCause;
  readonly replay: RuntimeReplayCause;
  readonly drift: RuntimeDriftCause;
  readonly blast: RuntimeBlastCause;
  readonly topology: RuntimeCausalityTopology;
  // Hard invariants — sempre falsos na fase 1.8.x.
  readonly liveExecutionEnabled: false;
  readonly realUsersAllowed: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface RuntimeCausalityHealth {
  readonly totalFlows: number;
  readonly healthy: number;
  readonly degraded: number;
  readonly critical: number;
  readonly worstSeverity: CausalitySeverity;
  readonly worstClassification: CausalityClassification;
}

export interface RuntimeCausalitySummary {
  readonly totalFlows: number;
  readonly isolated: number;
  readonly dependent: number;
  readonly cascading: number;
  readonly recursive: number;
  readonly circular: number;
  readonly hidden: number;
}

export interface RuntimeCausalityViolation {
  readonly flow: FlowId | 'GLOBAL';
  readonly code: CausalityViolationCode;
  readonly detail: string;
}
