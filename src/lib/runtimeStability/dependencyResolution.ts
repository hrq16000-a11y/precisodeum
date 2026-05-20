/**
 * Fase 1.8.4 — Dependency resolution (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  DependencyResolution,
  RuntimeDependencyEdge,
  RuntimeDependencyNode,
  RuntimeDependencyResolution,
} from './stabilityTypes';

export interface DependencyResolutionInput {
  readonly flow: FlowId;
  readonly nodes: readonly RuntimeDependencyNode[];
  readonly edges: readonly RuntimeDependencyEdge[];
}

export function resolveFlowDependencies(
  input: DependencyResolutionInput,
): readonly RuntimeDependencyNode[] {
  return input.nodes.filter((n) => n.kind === 'owner');
}

export function resolveMirrorDependencies(
  input: DependencyResolutionInput,
): readonly RuntimeDependencyNode[] {
  return input.nodes.filter((n) => n.kind === 'mirror');
}

export function resolveFinalizeDependencies(
  input: DependencyResolutionInput,
): readonly RuntimeDependencyNode[] {
  return input.nodes.filter((n) => n.kind === 'finalize');
}

export function resolveReplayDependencies(
  input: DependencyResolutionInput,
): readonly RuntimeDependencyNode[] {
  return input.nodes.filter((n) => n.kind === 'replay');
}

export function detectUnresolvedDependency(
  nodes: readonly RuntimeDependencyNode[],
): number {
  return nodes.filter((n) => !n.resolved).length;
}

export function detectHiddenDependency(
  nodes: readonly RuntimeDependencyNode[],
): number {
  return nodes.filter((n) => n.hidden).length;
}

export function detectCircularDependency(
  edges: readonly RuntimeDependencyEdge[],
): boolean {
  if (edges.some((e) => e.circular)) return true;
  // DFS cycle detection
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const arr = adj.get(e.from) ?? [];
    arr.push(e.to);
    adj.set(e.from, arr);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (n: string): boolean => {
    if (visiting.has(n)) return true;
    if (visited.has(n)) return false;
    visiting.add(n);
    for (const m of adj.get(n) ?? []) {
      if (dfs(m)) return true;
    }
    visiting.delete(n);
    visited.add(n);
    return false;
  };
  for (const n of adj.keys()) {
    if (dfs(n)) return true;
  }
  return false;
}

export function calculateDependencyDepth(
  edges: readonly RuntimeDependencyEdge[],
): number {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const e of edges) {
    const arr = adj.get(e.from) ?? [];
    arr.push(e.to);
    adj.set(e.from, arr);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    if (!indeg.has(e.from)) indeg.set(e.from, indeg.get(e.from) ?? 0);
  }
  // longest path length (bounded). guard against cycles.
  if (detectCircularDependency(edges)) return edges.length;
  let best = 0;
  const memo = new Map<string, number>();
  const dfs = (n: string): number => {
    if (memo.has(n)) return memo.get(n)!;
    let m = 0;
    for (const c of adj.get(n) ?? []) m = Math.max(m, 1 + dfs(c));
    memo.set(n, m);
    return m;
  };
  for (const n of indeg.keys()) best = Math.max(best, dfs(n));
  return best;
}

export function classifyDependencyResolution(input: {
  unresolved: number;
  hidden: number;
  circular: boolean;
  total: number;
}): DependencyResolution {
  if (input.circular) return 'circular';
  if (input.hidden > 0 && input.unresolved === 0) return 'hidden';
  if (input.total === 0) return 'resolved';
  if (input.unresolved === 0) return 'resolved';
  if (input.unresolved < input.total) return 'partially_resolved';
  return 'unresolved';
}

export function buildDependencyResolution(
  input: DependencyResolutionInput,
): RuntimeDependencyResolution {
  const unresolvedCount = detectUnresolvedDependency(input.nodes);
  const hiddenCount = detectHiddenDependency(input.nodes);
  const circular = detectCircularDependency(input.edges);
  const depth = calculateDependencyDepth(input.edges);
  const resolution = classifyDependencyResolution({
    unresolved: unresolvedCount,
    hidden: hiddenCount,
    circular,
    total: input.nodes.length,
  });
  return {
    flow: input.flow,
    resolution,
    nodes: input.nodes,
    edges: input.edges,
    depth,
    unresolvedCount,
    hiddenCount,
    circular,
  };
}
