/**
 * Fase 1.8.7 — Runtime Enforcement types (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type EnforcementClassification =
  | 'SAFE'
  | 'GUARDED'
  | 'RESTRICTED'
  | 'BLOCKED'
  | 'LOCKED';

export type EnforcementViolationType =
  | 'live_execution_attempt'
  | 'boundary_escape'
  | 'implicit_mutation'
  | 'runtime_activation'
  | 'retry_enablement'
  | 'background_enablement'
  | 'promotion_override'
  | 'unsafe_topology'
  | 'unsafe_dependency'
  | 'recursive_runtime'
  | 'cross_layer_mutation';

export type EnforcementSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EnforcementLayer =
  | 'isolation' | 'integrity' | 'stability' | 'causality'
  | 'replay' | 'history' | 'recorder' | 'certification'
  | 'governance' | 'promotion' | 'pilot';

export type LockdownClassification =
  | 'fully_locked' | 'guarded' | 'restricted' | 'unsafe' | 'collapsed';

export type EnforcementCertificationLevel =
  | 'FULL' | 'PARTIAL' | 'CONDITIONAL' | 'BLOCKED';

export type EnforcementViolationCode =
  | 'BOUNDARY_ESCAPE_DETECTED'
  | 'IMPLICIT_MUTATION_DETECTED'
  | 'LIVE_RUNTIME_ACTIVATED'
  | 'RETRY_RUNTIME_ENABLED'
  | 'BACKGROUND_RUNTIME_ENABLED'
  | 'UNSAFE_TOPOLOGY_RUNTIME'
  | 'RECURSIVE_RUNTIME_DEPENDENCY'
  | 'NON_DETERMINISTIC_ENFORCEMENT';

export interface EnforcementBoundary {
  readonly flow: FlowId;
  readonly layer: EnforcementLayer;
  readonly classification: EnforcementClassification;
  readonly locked: boolean;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface EnforcementViolation {
  readonly flow: FlowId;
  readonly type: EnforcementViolationType;
  readonly severity: EnforcementSeverity;
  readonly layer: EnforcementLayer;
  readonly detail: string;
}

export interface EnforcementInvariant {
  readonly name: string;
  readonly satisfied: boolean;
  readonly detail: string;
}

export interface RuntimeEnforcement {
  readonly flow: FlowId;
  readonly classification: EnforcementClassification;
  readonly severity: EnforcementSeverity;
  readonly boundaries: readonly EnforcementBoundary[];
  readonly violations: readonly EnforcementViolation[];
  readonly invariants: readonly EnforcementInvariant[];
  readonly lockdown: LockdownClassification;
}

export interface EnforcementEnvelope {
  readonly flow: FlowId;
  readonly enforcement: RuntimeEnforcement;
  readonly score: number; // 0..1
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface EnforcementAggregation {
  readonly flows: number;
  readonly safe: number;
  readonly guarded: number;
  readonly restricted: number;
  readonly blocked: number;
  readonly locked: number;
  readonly averageScore: number;
  readonly worstSeverity: EnforcementSeverity;
  readonly totalViolations: number;
}

export interface EnforcementCertification {
  readonly flow: FlowId;
  readonly level: EnforcementCertificationLevel;
  readonly confidence: number; // 0..1
  readonly certified: boolean;
  readonly reasons: readonly string[];
}
