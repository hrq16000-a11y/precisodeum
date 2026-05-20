/**
 * Fase 1.8.0 — Shadow Runtime Recorder types (READ-ONLY).
 *
 * Apenas tipos + enums. Nenhum write, nenhum side-effect, nenhuma
 * persistência. Estruturas usadas em memória transitória para descrever
 * traces dos write paths legacy atuais e compará-los com simulation/
 * blueprint/certification/governance/promotion.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';

/* ---------- Enums (string-literal) ---------- */

export type TraceStepStatus =
  | 'pending'
  | 'started'
  | 'ok'
  | 'failed'
  | 'skipped'
  | 'aborted';

export type TraceConsistencyState =
  | 'consistent'
  | 'partial'
  | 'inconsistent'
  | 'orphaned'
  | 'unknown';

export type TraceExecutionMode =
  | 'shadow'
  | 'observe_only'
  | 'simulated'
  | 'inert';

export type TraceFailureClass =
  | 'none'
  | 'transient'
  | 'validation'
  | 'authorization'
  | 'dependency'
  | 'ordering'
  | 'mirror_dependency'
  | 'orphan'
  | 'critical';

export type TraceOrderingClass =
  | 'expected'
  | 'finalize_before_mirror'
  | 'mirror_before_owner'
  | 'progress_before_finalize'
  | 'out_of_order'
  | 'unsafe_dependency';

/* ---------- Severity / classification ---------- */

export type RuntimeTraceSeverity =
  | 'NONE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type RuntimeTraceClassification =
  | 'SAFE'
  | 'PARTIAL'
  | 'DIVERGENT'
  | 'ORPHAN_RISK'
  | 'MIRROR_DEPENDENT'
  | 'NON_ATOMIC'
  | 'EVENTUAL'
  | 'CRITICAL';

export type RuntimeRecorderViolationCode =
  | 'live_execution_attempted'
  | 'retry_attempted'
  | 'background_attempted'
  | 'persistence_attempted'
  | 'real_user_mutation'
  | 'ordering_inconsistency'
  | 'parity_inconsistency'
  | 'classification_inconsistency'
  | 'unsafe_payload_detected'
  | 'promotion_leak_detected'
  | 'mode_violation';

/* ---------- Trace primitives ---------- */

export interface RuntimeWriteStep {
  /** Logical name (e.g. 'profile', 'provider', 'service', 'finalize'). */
  step: string;
  status: TraceStepStatus;
  /** Monotonic ordering index inside the trace. */
  order: number;
  /** Logical duration bucket — no real timestamps recorded. */
  durationBucket: 'fast' | 'normal' | 'slow' | 'unknown';
  /** Step depends on these prior steps (logical). */
  dependsOn: string[];
  /** Boundary that owned this step. */
  boundary: RuntimeWriteBoundary;
  /** When step failed, optional failure metadata (PII-free). */
  failure?: RuntimeWriteFailure;
  /** Visibility window after step (matches simulation). */
  visibility: 'private' | 'partial' | 'public';
  /** True when this step requires a previously-finalized owner. */
  requiresOwner: boolean;
  /** True when this step writes to a mirror (avatar/progress/admin) rather than owner. */
  mirror: boolean;
}

export type RuntimeWriteBoundary =
  | 'multiWriteSync'
  | 'avatarSync'
  | 'onboardingProgressSync'
  | 'adminWriteBoundary'
  | 'executeOperation'
  | 'inline_call_site'
  | 'observer_only';

export interface RuntimeWriteFailure {
  /** Coarse code — never raw SQL message or stack. */
  code: string;
  class: TraceFailureClass;
  severity: RuntimeTraceSeverity;
  /** True when failure caused downstream steps to be skipped/aborted. */
  cascaded: boolean;
}

export interface RuntimeWriteOrdering {
  expectedOrder: string[];
  actualOrder: string[];
  class: TraceOrderingClass;
  violations: TraceOrderingClass[];
}

export interface RuntimeWriteTrace {
  /** Trace id — opaque, in-memory only. */
  id: string;
  flow: FlowId;
  source: RuntimeWriteBoundary;
  mode: TraceExecutionMode;
  /** Steps in the order they were appended. */
  steps: RuntimeWriteStep[];
  ordering: RuntimeWriteOrdering;
  consistency: TraceConsistencyState;
  classification: RuntimeTraceClassification;
  severity: RuntimeTraceSeverity;
  failureSummary: TraceFailureClass;
  mirrorDependent: boolean;
  orphanRisk: boolean;
  /** Read-only invariants — must always hold for every trace. */
  liveExecution: false;
  retry: false;
  background: false;
  persisted: false;
  realUserMutation: false;
}

export interface RuntimeExecutionSnapshot {
  flow: FlowId;
  trace: RuntimeWriteTrace;
  blast: BlastRadiusLevel;
  /** Logical writes observed per step. Empty for shadow/observe modes. */
  observedWrites: number;
  /** True when at least one step ended in failure or skipped due to dependency. */
  degraded: boolean;
  /** True when ordering matched expectation. */
  orderingOk: boolean;
}

export interface RuntimeRecorderViolation {
  code: RuntimeRecorderViolationCode;
  flow?: FlowId;
  detail: string;
}
