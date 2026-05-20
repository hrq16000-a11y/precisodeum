/**
 * Fase 1.8.1 — Runtime lineage analysis (READ-ONLY).
 *
 * Lineage = relação entre owner / mirror / finalize observada em traces.
 * Apenas leitura. Sem persistência.
 */

import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { FlowId } from '@/lib/operations/operationRegistry';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import type { RuntimeLineage, RuntimeLineageClass } from './runtimeHistoryTypes';

function ownersOf(trace: RuntimeWriteTrace): string[] {
  return trace.steps.filter((s) => !s.mirror).map((s) => s.step);
}

function mirrorsOf(trace: RuntimeWriteTrace): string[] {
  return trace.steps.filter((s) => s.mirror).map((s) => s.step);
}

function finalizersOf(trace: RuntimeWriteTrace): string[] {
  return trace.steps
    .filter((s) => s.step === 'finalize' || s.step === 'finalize_sync')
    .map((s) => s.step);
}

export function buildRuntimeLineage(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeLineage {
  const flowTraces = traces.filter((t) => t.flow === flow);
  const owners = new Set<string>();
  const mirrors = new Set<string>();
  const finalizers = new Set<string>();
  for (const t of flowTraces) {
    ownersOf(t).forEach((s) => owners.add(s));
    mirrorsOf(t).forEach((s) => mirrors.add(s));
    finalizersOf(t).forEach((s) => finalizers.add(s));
  }
  const gaps: string[] = [];
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (reg) {
    for (const expected of reg.steps) {
      const observed = flowTraces.some((t) => t.steps.some((s) => s.step === expected && s.status === 'ok'));
      if (!observed) gaps.push(expected);
    }
  }
  const lineageClass: RuntimeLineageClass = classifyRuntimeLineage({
    owners: [...owners],
    mirrors: [...mirrors],
    finalizers: [...finalizers],
    gaps,
    requiresFinalize: reg?.requiresFinalize ?? false,
  });
  return {
    flow,
    class: lineageClass,
    owners: [...owners],
    mirrors: [...mirrors],
    finalizers: [...finalizers],
    gaps,
  };
}

export function classifyRuntimeLineage(input: {
  owners: readonly string[];
  mirrors: readonly string[];
  finalizers: readonly string[];
  gaps: readonly string[];
  requiresFinalize: boolean;
}): RuntimeLineageClass {
  if (input.mirrors.length > 0 && input.owners.length === 0) return 'mirror_only';
  if (input.requiresFinalize && input.finalizers.length === 0) return 'finalize_gap';
  if (input.gaps.length > 0 && input.owners.length > 0) return 'broken';
  if (input.mirrors.length > 0 && input.owners.length === 0) return 'missing_owner';
  return 'intact';
}

export function detectBrokenLineage(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const l = buildRuntimeLineage(flow, traces);
  return l.class === 'broken' || l.class === 'mirror_only' || l.class === 'missing_owner';
}

export function detectMissingOwnerPropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const l = buildRuntimeLineage(flow, traces);
  return l.mirrors.length > 0 && l.owners.length === 0;
}

export function detectMirrorOnlyPropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildRuntimeLineage(flow, traces).class === 'mirror_only';
}

export function detectFinalizeLineageGap(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildRuntimeLineage(flow, traces).class === 'finalize_gap';
}
