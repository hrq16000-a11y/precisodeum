/**
 * Fase 1.9.12 — Recursive equilibrium core (READ-ONLY, deterministic).
 */

import type {
  ReqEdge,
  ReqEquilibriumClass,
  ReqEquilibriumPoint,
  ReqNode,
  ReqResolution,
  ReqSystem,
} from './recursiveEquilibriumTypes';

const MAX_ITER = 64;
const RECOVERY_WINDOW = 4;

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export function reqSignature(value: unknown): string {
  return fnv1a(stableStringify(value));
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

export function buildRecursiveSystem(
  id: string,
  nodes: readonly ReqNode[],
  edges: readonly ReqEdge[],
): ReqSystem {
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...edges].sort((a, b) =>
    a.id.localeCompare(b.id) ||
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target),
  );
  const sys = {
    id,
    nodes: Object.freeze(sortedNodes.map((n) => Object.freeze({ ...n }))),
    edges: Object.freeze(sortedEdges.map((e) => Object.freeze({ ...e }))),
    signature: '',
  } as { -readonly [K in keyof ReqSystem]: ReqSystem[K] };
  sys.signature = reqSignature({
    id,
    nodes: sys.nodes,
    edges: sys.edges,
  });
  return deepFreeze(sys) as ReqSystem;
}

function indexNodes(sys: ReqSystem): ReadonlyMap<string, ReqNode> {
  const m = new Map<string, ReqNode>();
  for (const n of sys.nodes) m.set(n.id, n);
  return m;
}

function successorsOf(sys: ReqSystem): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, string[]>();
  for (const n of sys.nodes) m.set(n.id, []);
  for (const e of sys.edges) {
    const list = m.get(e.source);
    if (list) list.push(e.target);
  }
  for (const [k, v] of m) m.set(k, [...v].sort());
  return m;
}

function classify(
  iter: number,
  cycle: boolean,
  diverged: boolean,
  recovered: boolean,
): ReqEquilibriumClass {
  if (diverged) return 'DIVERGENT';
  if (cycle) return 'OSCILLATING';
  if (iter === 0) return 'SEALED';
  if (iter >= MAX_ITER) return 'COLLAPSED';
  if (recovered) return 'RECOVERING';
  return 'STABLE';
}

export function resolveEquilibriumPoint(
  sys: ReqSystem,
  startId: string,
): ReqEquilibriumPoint {
  const nodes = indexNodes(sys);
  const succ = successorsOf(sys);
  const path: string[] = [];
  const seen = new Map<string, number>();
  let curId: string | undefined = startId;
  let steps = 0;
  let cycle = false;
  let prev = -Infinity;
  let increasing = 0;
  let decreasing = 0;

  while (curId && steps < MAX_ITER) {
    const cur = nodes.get(curId);
    if (!cur) break;
    if (seen.has(curId)) {
      cycle = true;
      break;
    }
    seen.set(curId, path.length);
    path.push(curId);
    if (cur.potential > prev) increasing += 1;
    else if (cur.potential < prev) decreasing += 1;
    prev = cur.potential;
    const nexts = succ.get(curId) ?? [];
    curId = nexts[0];
    steps += 1;
  }
  const diverged = steps >= MAX_ITER && increasing >= MAX_ITER / 2;
  const recovered =
    !diverged && decreasing >= RECOVERY_WINDOW && decreasing >= increasing;
  const equilibriumClass = classify(steps, cycle, diverged, recovered);
  return deepFreeze({
    id: startId,
    path: Object.freeze([...path]),
    iterations: steps,
    cycle,
    diverged,
    recovered,
    equilibriumClass,
  });
}

export function resolveRecursiveEquilibrium(sys: ReqSystem): ReqResolution {
  const points = sys.nodes.map((n) => resolveEquilibriumPoint(sys, n.id));
  const cycles: string[][] = [];
  const seenCycle = new Set<string>();
  for (const p of points) {
    if (!p.cycle) continue;
    const key = [...p.path].sort().join('>');
    if (seenCycle.has(key)) continue;
    seenCycle.add(key);
    cycles.push([...p.path]);
  }
  cycles.sort((a, b) => a.join('>').localeCompare(b.join('>')));
  const reachable = new Set<string>();
  for (const p of points) for (const id of p.path) reachable.add(id);
  const unreachable = sys.nodes
    .map((n) => n.id)
    .filter((id) => !reachable.has(id))
    .sort();
  return deepFreeze({
    system: sys,
    points: Object.freeze([...points].sort((a, b) => a.id.localeCompare(b.id))),
    cycles: Object.freeze(cycles.map((c) => Object.freeze(c))),
    unreachable: Object.freeze(unreachable),
  });
}
