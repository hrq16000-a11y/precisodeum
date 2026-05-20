/**
 * Fase 1.8.3 — Causality drift (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { buildFlowCausality } from './causalityGraph';
import type { PropagationMode, RuntimeDriftCause } from './causalityTypes';

export function detectDriftCausality(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeDriftCause {
  return buildFlowCausality(flow, traces).drift;
}

export function detectDriftEscalation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildFlowCausality(flow, traces).drift.escalating;
}

export function classifyDriftPropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): PropagationMode {
  const g = buildFlowCausality(flow, traces);
  if (g.drift.unbounded) return 'recursive';
  if (g.drift.escalating) return 'delayed';
  if (g.mirror.desynced) return 'eventual';
  return 'direct';
}

export function calculateDriftContainment(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): number {
  return buildFlowCausality(flow, traces).drift.containmentScore;
}

export function detectUnboundedDrift(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildFlowCausality(flow, traces).drift.unbounded;
}
