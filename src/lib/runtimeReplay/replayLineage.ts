/**
 * Fase 1.8.2 — Replay lineage (READ-ONLY).
 *
 * Reconstrução temporal do lineage (owner / mirror / finalize) sobre traces
 * já observados. Sem persistência, sem I/O.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { ReplayLineage, ReplayLineageClass } from './replayTypes';

export function buildReplayLineage(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayLineage {
  const flowTraces = traces.filter((t) => t.flow === flow);
  const owners = new Set<string>();
  const mirrors = new Set<string>();
  const finalizers = new Set<string>();
  for (const t of flowTraces) {
    for (const s of t.steps) {
      if (s.mirror) mirrors.add(s.step);
      else owners.add(s.step);
      if (s.step === 'finalize' || s.step === 'finalize_sync') finalizers.add(s.step);
    }
  }
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const gaps: string[] = [];
  if (reg) {
    for (const e of reg.steps) {
      const observed = flowTraces.some((t) => t.steps.some((s) => s.step === e && s.status === 'ok'));
      if (!observed) gaps.push(e);
    }
  }
  const cls = classifyReplayLineage({
    owners: [...owners],
    mirrors: [...mirrors],
    finalizers: [...finalizers],
    gaps,
    requiresFinalize: reg?.requiresFinalize ?? false,
    orphan: flowTraces.some((t) => t.orphanRisk),
  });

  return {
    flow,
    class: cls,
    gaps,
    temporalGap: detectReplayTemporalGap(flow, flowTraces),
    stateRegression: detectReplayStateRegression(flow, flowTraces),
  };
}

export function classifyReplayLineage(input: {
  owners: readonly string[];
  mirrors: readonly string[];
  finalizers: readonly string[];
  gaps: readonly string[];
  requiresFinalize: boolean;
  orphan: boolean;
}): ReplayLineageClass {
  if (input.orphan) return 'orphaned';
  if (input.mirrors.length > 0 && input.owners.length === 0) return 'mirror_only';
  if (input.requiresFinalize && input.finalizers.length === 0) return 'broken';
  if (input.gaps.length > 0 && input.owners.length > 0) return 'degraded';
  return 'intact';
}

export function detectBrokenReplayLineage(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const l = buildReplayLineage(flow, traces);
  return l.class === 'broken' || l.class === 'orphaned' || l.class === 'mirror_only';
}

export function detectReplayTemporalGap(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const flowTraces = traces.filter((t) => t.flow === flow);
  return flowTraces.some((t) =>
    t.steps.some((s) => s.status === 'skipped' || s.status === 'aborted'),
  );
}

export function detectReplayStateRegression(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const flowTraces = traces.filter((t) => t.flow === flow);
  if (flowTraces.length < 2) return false;
  for (let i = 1; i < flowTraces.length; i++) {
    const prev = flowTraces[i - 1];
    const cur = flowTraces[i];
    if (prev.consistency === 'consistent' && (cur.consistency === 'inconsistent' || cur.consistency === 'orphaned')) {
      return true;
    }
  }
  return false;
}
