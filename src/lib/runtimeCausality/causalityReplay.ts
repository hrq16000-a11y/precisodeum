/**
 * Fase 1.8.3 — Causality x Replay reconstruction (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { buildFlowCausality } from './causalityGraph';
import type { RuntimeCausalityGraph } from './causalityTypes';

export function reconstructReplayCausality(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeCausalityGraph {
  return buildFlowCausality(flow, traces);
}

export function reconstructTemporalCausality(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): { escalating: boolean; samples: number } {
  const g = buildFlowCausality(flow, traces);
  return { escalating: g.temporal.escalating, samples: g.temporal.samples };
}

export function reconstructPropagationTimeline(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): readonly string[] {
  const g = buildFlowCausality(flow, traces);
  return g.propagation.affectedSteps;
}

export function detectReplayCauseRegression(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildFlowCausality(flow, traces).replay.regression;
}

export function detectReplayCauseInstability(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildFlowCausality(flow, traces).replay.unstable;
}
