/**
 * Fase 1.8.7 — Dependency enforcement (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { EnforcementLayer, EnforcementViolation } from './enforcementTypes';

export interface DependencyEdge {
  readonly from: EnforcementLayer;
  readonly to: EnforcementLayer;
  readonly mutating?: boolean;
  readonly hidden?: boolean;
}

export interface DependencySignal {
  readonly flow: FlowId;
  readonly edges: readonly DependencyEdge[];
}

export interface DependencyAnalysis {
  readonly flow: FlowId;
  readonly totalEdges: number;
  readonly mutatingEdges: number;
  readonly hiddenEdges: number;
  readonly recursive: boolean;
  readonly violations: readonly EnforcementViolation[];
}

function hasCycle(edges: readonly DependencyEdge[]): boolean {
  const graph = new Map<EnforcementLayer, EnforcementLayer[]>();
  for (const e of edges) {
    const list = graph.get(e.from) ?? [];
    list.push(e.to);
    graph.set(e.from, list);
  }
  const visiting = new Set<EnforcementLayer>();
  const visited = new Set<EnforcementLayer>();
  function dfs(n: EnforcementLayer): boolean {
    if (visiting.has(n)) return true;
    if (visited.has(n)) return false;
    visiting.add(n);
    for (const next of graph.get(n) ?? []) if (dfs(next)) return true;
    visiting.delete(n);
    visited.add(n);
    return false;
  }
  for (const n of graph.keys()) if (dfs(n)) return true;
  return false;
}

export function detectUnsafeDependency(s: DependencySignal): EnforcementViolation | null {
  const unsafe = s.edges.find(e => e.mutating);
  if (!unsafe) return null;
  return {
    flow: s.flow, layer: unsafe.from, type: 'unsafe_dependency',
    severity: 'HIGH', detail: `unsafe_dep_${unsafe.from}_to_${unsafe.to}`,
  };
}

export function detectDependencyLeak(s: DependencySignal): EnforcementViolation | null {
  const leak = s.edges.find(e => e.hidden);
  if (!leak) return null;
  return {
    flow: s.flow, layer: leak.from, type: 'cross_layer_mutation',
    severity: 'MEDIUM', detail: 'hidden_dependency_leak',
  };
}

export function detectRecursiveDependency(s: DependencySignal): EnforcementViolation | null {
  if (!hasCycle(s.edges)) return null;
  const layer = s.edges[0]?.from ?? 'isolation';
  return {
    flow: s.flow, layer, type: 'recursive_runtime',
    severity: 'HIGH', detail: 'recursive_dependency',
  };
}

export function detectHiddenDependencyMutation(s: DependencySignal): EnforcementViolation | null {
  const e = s.edges.find(x => x.hidden && x.mutating);
  if (!e) return null;
  return {
    flow: s.flow, layer: e.from, type: 'implicit_mutation',
    severity: 'HIGH', detail: 'hidden_dependency_mutation',
  };
}

export function analyzeDependencyEnforcement(s: DependencySignal): DependencyAnalysis {
  const violations: EnforcementViolation[] = [];
  const a = detectUnsafeDependency(s); if (a) violations.push(a);
  const b = detectDependencyLeak(s); if (b) violations.push(b);
  const c = detectRecursiveDependency(s); if (c) violations.push(c);
  const d = detectHiddenDependencyMutation(s); if (d) violations.push(d);
  return {
    flow: s.flow,
    totalEdges: s.edges.length,
    mutatingEdges: s.edges.filter(e => e.mutating).length,
    hiddenEdges: s.edges.filter(e => e.hidden).length,
    recursive: hasCycle(s.edges),
    violations,
  };
}
