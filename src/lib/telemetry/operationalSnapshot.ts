/**
 * Fase 1.7.4 — Operational snapshot (READ-ONLY).
 *
 * Composição derivada que estende a Consistency Snapshot (1.7.2) e o
 * Architecture Score (1.7.3) com inteligência operacional desta fase.
 *
 * Tudo derivado. NENHUMA persistência. Sem mutar os tipos originais —
 * gera uma nova estrutura `OperationalSnapshot`.
 */

import {
  buildAllConsistencySnapshots,
  type BuildSnapshotOptions,
} from '@/lib/drift/buildConsistencySnapshot';
import {
  calculateArchitectureScore,
  type ArchitectureScore,
} from '@/lib/drift/architectureScore';
import type { ConsistencySnapshot } from '@/lib/drift/snapshotTypes';
import { buildRuntimeTelemetry } from './buildRuntimeTelemetry';
import { calculateAtomicMigrationPriority } from './atomicPriorityEngine';
import { calculateFlowHealth } from './flowHealth';
import type {
  AtomicMigrationPriorityEntry,
  OperationalRiskTelemetry,
  RuntimeFlowHealth,
  RuntimeTelemetryEvent,
  TelemetryAggregation,
  TelemetryConfidence,
} from './runtimeTelemetryTypes';

export interface OperationalSnapshot {
  generatedAt: number;
  consistency: ConsistencySnapshot;
  architecture: ArchitectureScore;
  telemetry: TelemetryAggregation;
  operationalRisk: OperationalRiskTelemetry[];
  atomicPriority: AtomicMigrationPriorityEntry[];
  runtimeHealth: RuntimeFlowHealth[];
  telemetryConfidence: TelemetryConfidence;
}

export interface BuildOperationalSnapshotOptions extends BuildSnapshotOptions {}

export function buildOperationalSnapshot(
  events: ReadonlyArray<RuntimeTelemetryEvent>,
  opts: BuildOperationalSnapshotOptions = {},
): OperationalSnapshot {
  const now = (opts.now ?? (() => 0))();
  const consistency = buildAllConsistencySnapshots(opts);
  const architecture = calculateArchitectureScore();
  const telemetry = buildRuntimeTelemetry(events, { now: opts.now });
  const health = calculateFlowHealth(telemetry.flows, telemetry.drifts, telemetry.mirrors);
  const priorities = calculateAtomicMigrationPriority(
    telemetry.flows,
    telemetry.drifts,
    telemetry.mirrors,
    telemetry.risks,
  );
  // Enrich the aggregation
  const enrichedTelemetry: TelemetryAggregation = {
    ...telemetry,
    health,
    priorities,
  };

  return {
    generatedAt: now,
    consistency,
    architecture,
    telemetry: enrichedTelemetry,
    operationalRisk: telemetry.risks,
    atomicPriority: priorities,
    runtimeHealth: health,
    telemetryConfidence: telemetry.overallConfidence,
  };
}
