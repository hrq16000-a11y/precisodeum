/**
 * Fase 1.8.3 — Causality topology (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { CausalitySeverity, RuntimeCausalityTopology } from './causalityTypes';

type Bucket =
  | 'owners' | 'mirrors' | 'finalizers' | 'onboarding'
  | 'progress' | 'avatar' | 'admin' | 'replay' | 'eventualSync';

function classifyStep(step: string, mirror: boolean): Bucket {
  const s = step.toLowerCase();
  if (mirror) return 'mirrors';
  if (s.startsWith('finalize')) return 'finalizers';
  if (s.includes('onboarding')) return 'onboarding';
  if (s.includes('progress')) return 'progress';
  if (s.includes('avatar')) return 'avatar';
  if (s.includes('admin')) return 'admin';
  if (s.includes('replay')) return 'replay';
  if (s.includes('sync') || s.includes('eventual')) return 'eventualSync';
  return 'owners';
}

export function buildCausalityTopology(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeCausalityTopology {
  const buckets: Record<Bucket, Set<string>> = {
    owners: new Set(), mirrors: new Set(), finalizers: new Set(),
    onboarding: new Set(), progress: new Set(), avatar: new Set(),
    admin: new Set(), replay: new Set(), eventualSync: new Set(),
  };
  const ft = traces.filter((t) => t.flow === flow);
  for (const t of ft) {
    for (const s of t.steps) {
      buckets[classifyStep(s.step, s.mirror)].add(s.step);
    }
  }
  const cycles = detectTopologyCycles(flow, ft);
  const hidden = detectHiddenTopologyDependencies(flow, ft);
  const risk = classifyTopologyRisk({ cycles, hidden, orphan: ft.some((t) => t.orphanRisk) });
  return {
    flow,
    owners: [...buckets.owners],
    mirrors: [...buckets.mirrors],
    finalizers: [...buckets.finalizers],
    onboarding: [...buckets.onboarding],
    progress: [...buckets.progress],
    avatar: [...buckets.avatar],
    admin: [...buckets.admin],
    replay: [...buckets.replay],
    eventualSync: [...buckets.eventualSync],
    cycles,
    hiddenDependencies: hidden,
    risk,
  };
}

export function detectTopologyCycles(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = traces.filter((t) => t.flow === flow);
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

export function detectHiddenTopologyDependencies(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const ft = traces.filter((t) => t.flow === flow);
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

export function classifyTopologyRisk(input: {
  cycles: boolean;
  hidden: boolean;
  orphan: boolean;
}): CausalitySeverity {
  if (input.cycles) return 'CRITICAL';
  if (input.hidden) return 'HIGH';
  if (input.orphan) return 'MEDIUM';
  return 'NONE';
}
