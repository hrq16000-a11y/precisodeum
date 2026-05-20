/**
 * Fase 1.8.3 — Causality detectors (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { RuntimeCausalityGraph } from './causalityTypes';

function ftOf(flow: FlowId, traces: readonly RuntimeWriteTrace[]) {
  return traces.filter((t) => t.flow === flow);
}

export function detectHiddenDependencyCause(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = ftOf(flow, traces);
  for (const t of ft) {
    const known = new Set(t.steps.map((s) => s.step));
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        if (!known.has(dep)) return true;
      }
    }
  }
  return false;
}

export function detectRecursivePropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = ftOf(flow, traces);
  return ft.some((t) => t.steps.some((s) => s.dependsOn.includes(s.step)));
}

export function detectCircularCausality(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = ftOf(flow, traces);
  const adj = new Map<string, Set<string>>();
  for (const t of ft) {
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        if (!adj.has(dep)) adj.set(dep, new Set());
        adj.get(dep)!.add(s.step);
      }
    }
  }
  const W = 0, G = 1, B = 2;
  const color = new Map<string, number>();
  function dfs(n: string): boolean {
    color.set(n, G);
    for (const m of adj.get(n) ?? []) {
      const c = color.get(m) ?? W;
      if (c === G) return true;
      if (c === W && dfs(m)) return true;
    }
    color.set(n, B);
    return false;
  }
  for (const n of adj.keys()) {
    if ((color.get(n) ?? W) === W && dfs(n)) return true;
  }
  return false;
}

export function detectFinalizeCascade(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return ftOf(flow, traces).some((t) =>
    t.steps.some((s) => s.step.startsWith('finalize') && (s.status === 'failed' || s.status === 'aborted')),
  );
}

export function detectMirrorCascade(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return ftOf(flow, traces).some((t) => t.mirrorDependent || t.orphanRisk);
}

export function detectOrderingCascade(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return ftOf(flow, traces).some((t) => t.ordering.class !== 'expected');
}

export function detectReplayCascade(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = ftOf(flow, traces);
  const sigs = new Set(ft.map((t) => t.ordering.actualOrder.join('>')));
  return sigs.size > 1;
}

export function detectTemporalEscalation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = ftOf(flow, traces);
  if (ft.length < 2) return false;
  const rank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
  for (let i = 1; i < ft.length; i++) {
    if (rank[ft[i].severity] > rank[ft[i - 1].severity]) return true;
  }
  return false;
}

export function detectBlastRadiusEscalation(graph: RuntimeCausalityGraph): boolean {
  return graph.blast.escalated || graph.blast.impactedFlows.length > 0;
}
