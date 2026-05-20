/**
 * Fase 1.8.5 — Runtime Integrity types (READ-ONLY).
 *
 * Estruturas puras, em memória, para descrever integridade sistêmica
 * entre runtime layers. Sem persistência, sem live execution.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

/* ---------- Enums ---------- */

export type IntegrityClassification =
  | 'intact'
  | 'degraded'
  | 'unstable'
  | 'compromised'
  | 'collapsed';

export type IntegrityContainment =
  | 'contained'
  | 'partially_contained'
  | 'leaking'
  | 'cascading'
  | 'unbounded';

export type IntegrityIsolation =
  | 'isolated'
  | 'boundary_shared'
  | 'mirror_exposed'
  | 'replay_exposed'
  | 'globally_exposed';

export type IntegrityRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type IntegrityLayerKind =
  | 'stability'
  | 'causality'
  | 'replay'
  | 'history'
  | 'recorder'
  | 'certification';

export type IntegrityPropagationKind =
  | 'owner'
  | 'mirrors'
  | 'finalize'
  | 'onboarding'
  | 'progress'
  | 'avatar'
  | 'admin'
  | 'replay'
  | 'causality'
  | 'stability'
  | 'eventual_sync';

export type IntegrityViolationCode =
  | 'integrity_gap'
  | 'containment_leak'
  | 'isolation_exposure'
  | 'recursive_integrity_propagation'
  | 'circular_integrity_dependency'
  | 'cross_layer_integrity_failure'
  | 'unsafe_integrity_escalation'
  | 'observability_pii_leak'
  | 'live_execution_attempted'
  | 'retry_attempted'
  | 'background_attempted';

export interface RuntimeIntegrityViolation {
  readonly flow: FlowId;
  readonly code: IntegrityViolationCode;
  readonly detail: string;
}

/* ---------- Core structures ---------- */

export interface RuntimeIntegrityLayer {
  readonly flow: FlowId;
  readonly kind: IntegrityLayerKind;
  readonly intact: boolean;
  readonly score: number; // 0..1
  readonly gaps: number;
}

export interface RuntimeIntegrityBoundary {
  readonly flow: FlowId;
  readonly between: readonly [IntegrityLayerKind, IntegrityLayerKind];
  readonly intact: boolean;
  readonly exposure: IntegrityIsolation;
}

export interface RuntimeIntegrityContainment {
  readonly flow: FlowId;
  readonly origin: 'mirror' | 'finalize' | 'replay' | 'drift' | 'propagation';
  readonly containment: IntegrityContainment;
  readonly depth: number;
  readonly cascading: boolean;
}

export interface RuntimeIntegrityIsolation {
  readonly flow: FlowId;
  readonly isolation: IntegrityIsolation;
  readonly leakedLayers: readonly IntegrityLayerKind[];
  readonly boundariesIntact: boolean;
}

export interface RuntimeIntegrityPropagation {
  readonly flow: FlowId;
  readonly kind: IntegrityPropagationKind;
  readonly depth: number;
  readonly leaking: boolean;
  readonly recursive: boolean;
  readonly circular: boolean;
}

export interface RuntimeIntegrityTopology {
  readonly flow: FlowId;
  readonly layers: readonly RuntimeIntegrityLayer[];
  readonly boundaries: readonly RuntimeIntegrityBoundary[];
  readonly gapCount: number;
  readonly recursive: boolean;
  readonly leaking: boolean;
}

export interface RuntimeIntegrityWindow {
  readonly flow: FlowId;
  readonly samples: number;
  readonly intactSamples: number;
  readonly degradedSamples: number;
}

export interface RuntimeIntegrityEnvelope {
  readonly flow: FlowId;
  readonly classification: IntegrityClassification;
  readonly score: number; // 0..1
  readonly risk: IntegrityRisk;
  readonly topology: RuntimeIntegrityTopology;
  readonly containment: readonly RuntimeIntegrityContainment[];
  readonly isolation: RuntimeIntegrityIsolation;
  readonly propagation: readonly RuntimeIntegrityPropagation[];
  readonly window: RuntimeIntegrityWindow;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly currentStage: 'STAGE_0_READ_ONLY';
}

export interface RuntimeIntegrityHealth {
  readonly flows: number;
  readonly intact: number;
  readonly degraded: number;
  readonly unstable: number;
  readonly compromised: number;
  readonly collapsed: number;
  readonly averageScore: number;
  readonly worstRisk: IntegrityRisk;
}

export interface RuntimeIntegritySummary {
  readonly flow: FlowId;
  readonly classification: IntegrityClassification;
  readonly risk: IntegrityRisk;
  readonly containment: IntegrityContainment;
  readonly isolation: IntegrityIsolation;
}
