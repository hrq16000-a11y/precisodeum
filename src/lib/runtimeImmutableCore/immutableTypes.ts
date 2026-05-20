/**
 * Fase 1.8.8 — Runtime Immutable Core types (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type ImmutableClassification =
  | 'IMMUTABLE'
  | 'SEALED'
  | 'GUARDED'
  | 'RESTRICTED'
  | 'COMPROMISED';

export type ImmutableViolationType =
  | 'runtime_mutation'
  | 'implicit_runtime_enablement'
  | 'cross_layer_side_effect'
  | 'unsafe_promotion'
  | 'drift_escape'
  | 'boundary_override'
  | 'recursive_runtime_unlock'
  | 'topology_instability'
  | 'runtime_regression'
  | 'non_deterministic_state';

export type ImmutableSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ImmutableLayer =
  | 'enforcement' | 'isolation' | 'integrity' | 'stability'
  | 'causality' | 'replay' | 'history' | 'recorder'
  | 'governance' | 'promotion' | 'certification' | 'pilot';

export type ImmutableCertificationLevel =
  | 'FULL' | 'PARTIAL' | 'CONDITIONAL' | 'BLOCKED';

export type ImmutableViolationCode =
  | 'IMMUTABLE_SEAL_COMPROMISED'
  | 'RUNTIME_UNLOCK_DETECTED'
  | 'CROSS_LAYER_ESCAPE_DETECTED'
  | 'IMMUTABLE_INVARIANT_BROKEN'
  | 'NON_DETERMINISTIC_IMMUTABLE_STATE'
  | 'IMMUTABLE_TOPOLOGY_UNSAFE'
  | 'IMMUTABLE_CERTIFICATION_FAILED'
  | 'IMMUTABLE_RUNTIME_REGRESSION';

export interface ImmutableBoundary {
  readonly flow: FlowId;
  readonly layer: ImmutableLayer;
  readonly sealed: boolean;
  readonly classification: ImmutableClassification;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface ImmutableViolation {
  readonly flow: FlowId;
  readonly layer: ImmutableLayer;
  readonly type: ImmutableViolationType;
  readonly severity: ImmutableSeverity;
  readonly detail: string;
}

export interface ImmutableInvariant {
  readonly name: string;
  readonly satisfied: boolean;
  readonly detail: string;
}

export interface ImmutableSeal {
  readonly flow: FlowId;
  readonly classification: ImmutableClassification;
  readonly severity: ImmutableSeverity;
  readonly boundaries: readonly ImmutableBoundary[];
  readonly violations: readonly ImmutableViolation[];
  readonly invariants: readonly ImmutableInvariant[];
  readonly compromised: boolean;
}

export interface ImmutableEnvelope {
  readonly flow: FlowId;
  readonly seal: ImmutableSeal;
  readonly score: number; // 0..1
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface ImmutableAggregation {
  readonly flows: number;
  readonly immutable: number;
  readonly sealed: number;
  readonly guarded: number;
  readonly restricted: number;
  readonly compromised: number;
  readonly averageScore: number;
  readonly worstSeverity: ImmutableSeverity;
  readonly totalViolations: number;
}

export interface ImmutableCertification {
  readonly flow: FlowId;
  readonly level: ImmutableCertificationLevel;
  readonly confidence: number; // 0..1
  readonly certified: boolean;
  readonly reasons: readonly string[];
}
