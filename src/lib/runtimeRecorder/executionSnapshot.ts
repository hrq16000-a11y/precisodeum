/**
 * Fase 1.8.0 — Runtime execution snapshots (READ-ONLY).
 */

import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';
import { finalizeRuntimeTrace } from './traceRecorder';
import type {
  RuntimeExecutionSnapshot,
  RuntimeWriteTrace,
} from './recorderTypes';

export function buildExecutionSnapshot(
  trace: RuntimeWriteTrace,
): RuntimeExecutionSnapshot {
  const finalized = finalizeRuntimeTrace(trace);
  const blastReport = calculateBlastRadius(finalized.flow);
  const blast: BlastRadiusLevel = blastReport?.level ?? 'LOW';
  const observedWrites =
    finalized.mode === 'shadow' || finalized.mode === 'observe_only'
      ? 0
      : finalized.steps.filter((s) => s.status === 'ok' && !s.mirror).length;
  const degraded = finalized.steps.some(
    (s) => s.status === 'failed' || s.status === 'aborted',
  );
  const orderingOk = finalized.ordering.violations.length === 0;
  return {
    flow: finalized.flow,
    trace: finalized,
    blast,
    observedWrites,
    degraded,
    orderingOk,
  };
}

export interface SnapshotComparison {
  flow: string;
  classificationMatch: boolean;
  orderingMatch: boolean;
  consistencyMatch: boolean;
  severityDelta: number;
  divergent: boolean;
}

const SEV_RANK = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;

export function compareExecutionSnapshots(
  a: RuntimeExecutionSnapshot,
  b: RuntimeExecutionSnapshot,
): SnapshotComparison {
  const classificationMatch = a.trace.classification === b.trace.classification;
  const orderingMatch = a.orderingOk === b.orderingOk;
  const consistencyMatch = a.trace.consistency === b.trace.consistency;
  const severityDelta =
    SEV_RANK[b.trace.severity] - SEV_RANK[a.trace.severity];
  const divergent =
    !classificationMatch ||
    !orderingMatch ||
    !consistencyMatch ||
    Math.abs(severityDelta) > 0;
  return {
    flow: a.flow,
    classificationMatch,
    orderingMatch,
    consistencyMatch,
    severityDelta,
    divergent,
  };
}

export function detectExecutionDivergence(
  a: RuntimeExecutionSnapshot,
  b: RuntimeExecutionSnapshot,
): boolean {
  return compareExecutionSnapshots(a, b).divergent;
}

export function explainExecutionSnapshot(snap: RuntimeExecutionSnapshot): string {
  return [
    `flow=${snap.flow}`,
    `class=${snap.trace.classification}`,
    `ordering=${snap.orderingOk ? 'ok' : 'violated'}`,
    `consistency=${snap.trace.consistency}`,
    `severity=${snap.trace.severity}`,
    `blast=${snap.blast}`,
  ].join(' · ');
}
