/**
 * Fase 1.7.4 — Runtime Telemetry + Operational Intelligence Layer (READ-ONLY).
 *
 * Tipos PUROS e SERIALIZÁVEIS para inteligência operacional sobre fluxos.
 * Não contém lógica, Supabase, hooks, timers ou referências a runtime.
 *
 * Modelo:
 *  - FlowExecutionTelemetry      → frequência/falhas por flow
 *  - BoundaryExecutionTelemetry  → frequência por boundary
 *  - MirrorUsageTelemetry        → frequência de dependência de mirror
 *  - DriftTelemetry              → frequência de drift detectado
 *  - OperationalRiskTelemetry    → risco operacional agregado
 *  - TelemetryAggregation        → roll-up canônico
 *  - RuntimeFlowHealth           → estado operacional por flow
 *
 * Inputs aceitos são apenas eventos estruturais já existentes (audit actions,
 * snapshots, readiness). Nenhuma PII, nenhum payload bruto.
 */

import type { BoundaryId, FlowId, Readiness } from '@/lib/operations/operationRegistry';
import type { ConsistencyRiskLevel } from '@/lib/drift/snapshotTypes';

export type OperationalRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AtomicMigrationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FlowHealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Confiança estatística do telemetria (proxy de volume amostral). */
export type TelemetryConfidence = 'none' | 'low' | 'medium' | 'high';

/** Evento estrutural mínimo aceito pelo aggregator (sem PII). */
export interface RuntimeTelemetryEvent {
  flow?: FlowId | null;
  boundary?: BoundaryId | null;
  /** Categoria do evento estrutural — não conteúdo. */
  kind:
    | 'flow_execution'
    | 'flow_failure'
    | 'flow_partial_success'
    | 'boundary_execution'
    | 'boundary_failure'
    | 'mirror_write'
    | 'eventual_sync'
    | 'drift_detected'
    | 'reconciliation_blocked'
    | 'rollback_invoked';
  /** Severidade opcional propagada do evento de origem. */
  severity?: ConsistencyRiskLevel | null;
  /** Marcação temporal lógica (ordinal, não wall-clock). */
  at?: number;
}

export interface FlowExecutionTelemetry {
  flow: FlowId;
  executions: number;
  failures: number;
  partialSuccesses: number;
  rollbacks: number;
  failureRate: number;        // 0..1
  partialRate: number;        // 0..1
  rollbackRate: number;       // 0..1
  confidence: TelemetryConfidence;
}

export interface BoundaryExecutionTelemetry {
  boundary: BoundaryId;
  executions: number;
  failures: number;
  failureRate: number;        // 0..1
  flows: FlowId[];
  confidence: TelemetryConfidence;
}

export interface MirrorUsageTelemetry {
  flow: FlowId;
  mirrorWrites: number;
  totalExecutions: number;
  mirrorRate: number;         // 0..1
  hasOwnershipResolved: boolean;
  confidence: TelemetryConfidence;
}

export interface DriftTelemetry {
  flow: FlowId;
  driftEvents: number;
  totalExecutions: number;
  driftRate: number;          // 0..1
  reconciliationBlocked: number;
  confidence: TelemetryConfidence;
}

export interface OperationalRiskTelemetry {
  flow: FlowId;
  riskLevel: OperationalRiskLevel;
  /** 0..100 score interno (maior = pior). */
  riskScore: number;
  contributors: string[];     // razões estruturais (sem PII)
  readiness: Readiness;
  exposesEventualConsistency: boolean;
}

export interface RuntimeFlowHealth {
  flow: FlowId;
  grade: FlowHealthGrade;
  /** 0..100 (100 = saudável). */
  score: number;
  readiness: Readiness;
  failureRate: number;
  driftRate: number;
  mirrorRate: number;
  isOvercoupled: boolean;
  isOverdependentOnMirror: boolean;
  isStructurallyReadyButOperationallyDegraded: boolean;
  confidence: TelemetryConfidence;
}

export interface AtomicMigrationPriorityEntry {
  flow: FlowId;
  priority: AtomicMigrationPriority;
  /** 0..100; HIGH/CRITICAL aparecem no topo. */
  score: number;
  reasons: string[];
}

export interface TelemetryAggregation {
  generatedAt: number;
  totalEvents: number;
  flows: FlowExecutionTelemetry[];
  boundaries: BoundaryExecutionTelemetry[];
  mirrors: MirrorUsageTelemetry[];
  drifts: DriftTelemetry[];
  risks: OperationalRiskTelemetry[];
  health: RuntimeFlowHealth[];
  priorities: AtomicMigrationPriorityEntry[];
  overallConfidence: TelemetryConfidence;
}
