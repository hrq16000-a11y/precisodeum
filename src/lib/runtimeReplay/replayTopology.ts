/**
 * Fase 1.8.2 — Replay topology (READ-ONLY).
 *
 * Classifica owners/mirrors/finalizers/onboarding/progress/avatar/admin/
 * eventual_sync sobre traces observados. Sem persistência, sem I/O.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { ReplayPropagation, ReplayTopology } from './replayTypes';

function classifyStep(step: string): keyof Omit<ReplayTopology, 'flow' | 'propagation' | 'circularDependency' | 'hiddenDependency'> {
  const s = step.toLowerCase();
  if (s.startsWith('finalize')) return 'finalizers';
  if (s.includes('onboarding')) return 'onboarding';
  if (s.includes('progress')) return 'progress';
  if (s.includes('avatar')) return 'avatar';
  if (s.includes('admin')) return 'admin';
  if (s.includes('sync') || s.includes('eventual')) return 'eventualSync';
  return 'owners';
}

export function buildReplayTopology(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayTopology {
  const buckets = {
    owners: new Set<string>(),
    mirrors: new Set<string>(),
    finalizers: new Set<string>(),
    onboarding: new Set<string>(),
    progress: new Set<string>(),
    avatar: new Set<string>(),
    admin: new Set<string>(),
    eventualSync: new Set<string>(),
  };
  const flowTraces = traces.filter((t) => t.flow === flow);
  for (const t of flowTraces) {
    for (const s of t.steps) {
      if (s.mirror) buckets.mirrors.add(s.step);
      const cat = classifyStep(s.step);
      buckets[cat].add(s.step);
    }
  }
  const propagation = classifyTopologyPropagation(flowTraces);
  const circularDependency = detectCircularReplayDependency(flow, flowTraces);
  const hiddenDependency = detectHiddenReplayDependency(flow, flowTraces);
  return {
    flow,
    owners: [...buckets.owners],
    mirrors: [...buckets.mirrors],
    finalizers: [...buckets.finalizers],
    onboarding: [...buckets.onboarding],
    progress: [...buckets.progress],
    avatar: [...buckets.avatar],
    admin: [...buckets.admin],
    eventualSync: [...buckets.eventualSync],
    propagation,
    circularDependency,
    hiddenDependency,
  };
}

export function classifyTopologyPropagation(
  traces: readonly RuntimeWriteTrace[],
): ReplayPropagation {
  if (traces.length === 0) return 'isolated';
  const anyCascade = traces.some((t) => t.steps.some((s) => s.failure?.cascaded));
  const anyOrphan = traces.some((t) => t.orphanRisk);
  const anyMirror = traces.some((t) => t.mirrorDependent);
  const failed = traces.some((t) => t.steps.some((s) => s.status === 'failed'));
  if (anyOrphan) return 'cascading';
  if (anyCascade) return 'cascading';
  if (anyMirror) return 'contained';
  if (failed) return 'contained';
  return 'isolated';
}

export function detectCircularReplayDependency(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const flowTraces = traces.filter((t) => t.flow === flow);
  const adj = new Map<string, Set<string>>();
  for (const t of flowTraces) {
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        if (!adj.has(dep)) adj.set(dep, new Set());
        adj.get(dep)!.add(s.step);
      }
    }
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  function dfs(n: string): boolean {
    color.set(n, GRAY);
    for (const m of adj.get(n) ?? []) {
      const c = color.get(m) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(m)) return true;
    }
    color.set(n, BLACK);
    return false;
  }
  for (const n of adj.keys()) {
    if ((color.get(n) ?? WHITE) === WHITE && dfs(n)) return true;
  }
  return false;
}

export function detectHiddenReplayDependency(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const flowTraces = traces.filter((t) => t.flow === flow);
  // Hidden = um step depende de outro que NUNCA aparece como step ok em algum trace.
  for (const t of flowTraces) {
    const known = new Set(t.steps.map((s) => s.step));
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        if (!known.has(dep)) return true;
      }
    }
  }
  return false;
}
