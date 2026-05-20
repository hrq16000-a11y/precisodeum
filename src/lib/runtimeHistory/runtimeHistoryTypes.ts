/**
 * Fase 1.8.1 — Runtime History types (READ-ONLY).
 *
 * Tipos puros. Sem I/O, sem storage real, sem persistência. Toda a camada
 * de history opera em memória transitória sobre dados já observados pelo
 * runtimeRecorder, simulation, certification, governance, etc.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  RuntimeTraceClassification,
  RuntimeTraceSeverity,
  RuntimeWriteTrace,
  TraceConsistencyState,
  TraceOrderingClass,
  TraceFailureClass,
} from '@/lib/runtimeRecorder/recorderTypes';

/* ---------- Enums ---------- */

export type RuntimeTrendDirection =
  | 'improving'
  | 'stable'
  | 'degrading'
  | 'volatile'
  | 'unknown';

export type RuntimeHistorySeverity =
  | 'NONE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type RuntimePropagationRisk =
  | 'isolated'
  | 'contained'
  | 'cascading'
  | 'circular'
  | 'unknown';

export type RuntimeLineageClass =
  | 'intact'
  | 'mirror_only'
  | 'missing_owner'
  | 'finalize_gap'
  | 'broken';

export type RuntimeHistoryViolationCode =
  | 'persistence_attempted'
  | 'live_execution_attempted'
  | 'rollout_attempted'
  | 'pilot_attempted'
  | 'retry_attempted'
  | 'background_attempted'
  | 'temporal_regression'
  | 'lineage_inconsistency'
  | 'propagation_inconsistency'
  | 'parity_regression'
  | 'unsafe_promotion_leak';

/* ---------- History entries ---------- */

export interface RuntimeHistoryEntry {
  readonly id: string;
  readonly flow: FlowId;
  readonly traceId: string;
  readonly sequence: number;
  readonly logicalTimestamp: number; // monotonic logical clock, NOT wall time
  readonly classification: RuntimeTraceClassification;
  readonly severity: RuntimeTraceSeverity;
  readonly consistency: TraceConsistencyState;
  readonly ordering: TraceOrderingClass;
  readonly failure: TraceFailureClass;
  readonly mirrorDependent: boolean;
  readonly orphanRisk: boolean;
  // execution invariants (always false in fase 1.8.x)
  readonly liveExecution: false;
  readonly persisted: false;
  readonly retry: false;
  readonly background: false;
  readonly realUserMutation: false;
}

export interface RuntimeHistoryWindow {
  readonly flow: FlowId;
  readonly entries: readonly RuntimeHistoryEntry[];
  readonly windowSize: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
}

/* ---------- Trends ---------- */

export interface RuntimeConsistencyTrend {
  readonly flow: FlowId;
  readonly direction: RuntimeTrendDirection;
  readonly consistentRatio: number;
  readonly orphanRatio: number;
  readonly inconsistentRatio: number;
  readonly samples: number;
}

export interface RuntimeParityTrend {
  readonly flow: FlowId;
  readonly direction: RuntimeTrendDirection;
  readonly avgParityGap: number;
  readonly maxParityGap: number;
  readonly samples: number;
}

export interface RuntimeDriftTrend {
  readonly flow: FlowId;
  readonly direction: RuntimeTrendDirection;
  readonly driftEvents: number;
  readonly emergenceScore: number; // 0..1
  readonly samples: number;
}

export interface RuntimeOrderingTrend {
  readonly flow: FlowId;
  readonly direction: RuntimeTrendDirection;
  readonly violations: number;
  readonly violationRatio: number;
  readonly samples: number;
}

export interface RuntimeFailureTrend {
  readonly flow: FlowId;
  readonly direction: RuntimeTrendDirection;
  readonly failureRatio: number;
  readonly escalating: boolean;
  readonly samples: number;
}

/* ---------- Lineage ---------- */

export interface RuntimeLineage {
  readonly flow: FlowId;
  readonly class: RuntimeLineageClass;
  readonly owners: readonly string[];
  readonly mirrors: readonly string[];
  readonly finalizers: readonly string[];
  readonly gaps: readonly string[];
}

/* ---------- Propagation ---------- */

export interface RuntimePropagationChain {
  readonly flow: FlowId;
  readonly nodes: readonly string[];
  readonly edges: ReadonlyArray<readonly [string, string]>;
  readonly risk: RuntimePropagationRisk;
  readonly cycle: readonly string[];
  readonly hidden: readonly string[];
}

/* ---------- Aggregated views ---------- */

export interface RuntimeHistoryHealth {
  readonly flow: FlowId;
  readonly severity: RuntimeHistorySeverity;
  readonly trends: {
    readonly consistency: RuntimeConsistencyTrend;
    readonly parity: RuntimeParityTrend;
    readonly drift: RuntimeDriftTrend;
    readonly ordering: RuntimeOrderingTrend;
    readonly failure: RuntimeFailureTrend;
  };
  readonly lineage: RuntimeLineage;
  readonly propagation: RuntimePropagationChain;
  readonly confidence: number; // 0..1
}

export interface RuntimeHistoryViolation {
  readonly flow: FlowId | 'GLOBAL';
  readonly code: RuntimeHistoryViolationCode;
  readonly detail: string;
}

/* ---------- Helper trace alias for adapters ---------- */
export type SourceTrace = RuntimeWriteTrace;
