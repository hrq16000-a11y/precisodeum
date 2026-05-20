/**
 * Fase 1.8.1 — Propagation chain analysis (READ-ONLY).
 *
 * Calcula cadeias de dependência entre steps a partir de `dependsOn`,
 * detecta ciclos, dependências escondidas e propagação insegura.
 */

import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimePropagationChain, RuntimePropagationRisk } from './runtimeHistoryTypes';

export function buildPropagationChain(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimePropagationChain {
  const nodes = new Set<string>();
  const edges: Array<readonly [string, string]> = [];
  const edgeKeys = new Set<string>();
  for (const t of traces.filter((x) => x.flow === flow)) {
    for (const s of t.steps) {
      nodes.add(s.step);
      for (const dep of s.dependsOn) {
        nodes.add(dep);
        const k = `${dep}->${s.step}`;
        if (!edgeKeys.has(k)) {
          edgeKeys.add(k);
          edges.push([dep, s.step] as const);
        }
      }
    }
  }
  const cycle = findCycle([...nodes], edges);
  const hidden = findHiddenDependencies(traces.filter((x) => x.flow === flow));
  const risk = classifyPropagationRisk({
    nodeCount: nodes.size,
    edgeCount: edges.length,
    cycleLength: cycle.length,
    hiddenCount: hidden.length,
  });
  return {
    flow,
    nodes: [...nodes],
    edges,
    risk,
    cycle,
    hidden,
  };
}

function findCycle(
  nodes: readonly string[],
  edges: ReadonlyArray<readonly [string, string]>,
): string[] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const [a, b] of edges) adj.get(a)?.push(b);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n, WHITE);
  const stack: string[] = [];
  let found: string[] = [];
  const dfs = (n: string): boolean => {
    color.set(n, GRAY);
    stack.push(n);
    for (const m of adj.get(n) ?? []) {
      if (color.get(m) === GRAY) {
        const idx = stack.indexOf(m);
        found = stack.slice(idx).concat(m);
        return true;
      }
      if (color.get(m) === WHITE && dfs(m)) return true;
    }
    stack.pop();
    color.set(n, BLACK);
    return false;
  };
  for (const n of nodes) {
    if (color.get(n) === WHITE && dfs(n)) break;
  }
  return found;
}

function findHiddenDependencies(traces: readonly RuntimeWriteTrace[]): string[] {
  // dependência "escondida" = step ok cujo dep não aparece como step declarado em nenhum trace
  const declared = new Set<string>();
  for (const t of traces) for (const s of t.steps) declared.add(s.step);
  const hidden = new Set<string>();
  for (const t of traces) {
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        if (!declared.has(dep)) hidden.add(dep);
      }
    }
  }
  return [...hidden];
}

export function detectUnsafePropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const c = buildPropagationChain(flow, traces);
  return c.risk === 'cascading' || c.risk === 'circular';
}

export function detectCircularPropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildPropagationChain(flow, traces).cycle.length > 0;
}

export function detectHiddenDependencyPropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  return buildPropagationChain(flow, traces).hidden.length > 0;
}

export function classifyPropagationRisk(input: {
  nodeCount: number;
  edgeCount: number;
  cycleLength: number;
  hiddenCount: number;
}): RuntimePropagationRisk {
  if (input.nodeCount === 0) return 'unknown';
  if (input.cycleLength > 0) return 'circular';
  if (input.hiddenCount > 0) return 'cascading';
  if (input.edgeCount === 0) return 'isolated';
  if (input.edgeCount <= input.nodeCount) return 'contained';
  return 'cascading';
}
