// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Topology
// Pure, deterministic DAG/cycle analysis over meta transformations. Read-only.

import type {
  MetaTopologyClass,
  RuntimeMetaTopology,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';

const STAGE_0 = 'STAGE_0_READ_ONLY' as const;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
}

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'topo_' + h.toString(16).padStart(8, '0');
}

interface Edge {
  readonly from: string;
  readonly to: string;
}

interface TopologyGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly Edge[];
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
}

function buildGraph(t: RuntimeMetaTransformation): TopologyGraph {
  const nodes = t.components.map((c) => c.id).slice().sort();
  const edgeSet = new Map<string, Edge>();
  for (const c of t.components) {
    for (const m of c.morphisms) {
      const target = String(m);
      if (target === c.id) continue;
      const key = c.id + '->' + target;
      if (!edgeSet.has(key)) edgeSet.set(key, { from: c.id, to: target });
    }
  }
  const edges = Array.from(edgeSet.values()).sort((a, b) =>
    a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1,
  );
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n, []);
  for (const e of edges) {
    const arr = adjacency.get(e.from);
    if (arr) arr.push(e.to);
  }
  const frozenAdj = new Map<string, readonly string[]>();
  for (const [k, v] of adjacency) frozenAdj.set(k, Object.freeze(v.slice().sort()));
  return deepFreeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    adjacency: frozenAdj,
  }) as TopologyGraph;
}

export function detectMetaTopologyCycles(t: RuntimeMetaTransformation): readonly string[] {
  const g = buildGraph(t);
  const cycles: string[] = [];
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const n of g.nodes) color.set(n, WHITE);

  const visit = (node: string, path: string[]): void => {
    color.set(node, GRAY);
    path.push(node);
    const next = g.adjacency.get(node) ?? [];
    for (const nxt of next) {
      const c = color.get(nxt);
      if (c === undefined) continue;
      if (c === GRAY) {
        const idx = path.indexOf(nxt);
        const cycle = idx >= 0 ? path.slice(idx).concat(nxt) : [nxt];
        cycles.push(cycle.join('->'));
      } else if (c === WHITE) {
        visit(nxt, path);
      }
    }
    path.pop();
    color.set(node, BLACK);
  };

  for (const n of g.nodes) {
    if (color.get(n) === WHITE) visit(n, []);
  }
  return Object.freeze(Array.from(new Set(cycles)).sort());
}

export function detectMetaTopologyIsolationLeaks(t: RuntimeMetaTransformation): readonly string[] {
  const g = buildGraph(t);
  const referenced = new Set<string>();
  for (const e of g.edges) {
    referenced.add(e.from);
    referenced.add(e.to);
  }
  const isolated: string[] = [];
  for (const n of g.nodes) if (!referenced.has(n)) isolated.push(n);
  return Object.freeze(isolated.sort());
}

function computePropagationDepth(g: TopologyGraph): number {
  if (g.nodes.length === 0) return 0;
  let best = 0;
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const dfs = (node: string): number => {
    if (visiting.has(node)) return 0;
    const cached = memo.get(node);
    if (cached !== undefined) return cached;
    visiting.add(node);
    let m = 0;
    for (const nxt of g.adjacency.get(node) ?? []) {
      const d = dfs(nxt);
      if (d > m) m = d;
    }
    visiting.delete(node);
    const res = m + 1;
    memo.set(node, res);
    return res;
  };
  for (const n of g.nodes) {
    const d = dfs(n);
    if (d > best) best = d;
  }
  return best;
}

function classify(connectivity: number, cycles: number, isolated: number, nodes: number): MetaTopologyClass {
  if (nodes === 0) return 'COLLAPSED';
  if (cycles > 0 && connectivity < 0.4) return 'COLLAPSED';
  if (cycles > 0) return 'UNSTABLE';
  if (isolated > nodes / 2) return 'WEAK';
  if (connectivity >= 0.85) return 'STABLE';
  if (connectivity >= 0.55) return 'WEAK';
  return 'UNSTABLE';
}

export function classifyMetaTopology(t: RuntimeMetaTransformation): MetaTopologyClass {
  return buildMetaTopology(t).class;
}

export function computeMetaTopologySignature(t: RuntimeMetaTransformation): string {
  const g = buildGraph(t);
  return hash(stableStringify({ n: g.nodes, e: g.edges.map((e) => e.from + '>' + e.to) }));
}

export function buildMetaTopology(t: RuntimeMetaTransformation): RuntimeMetaTopology {
  const g = buildGraph(t);
  const cycles = detectMetaTopologyCycles(t);
  const isolated = detectMetaTopologyIsolationLeaks(t);
  const depth = computePropagationDepth(g);
  const denom = Math.max(1, g.nodes.length);
  const connectivity = g.nodes.length === 0
    ? 0
    : Math.min(1, Math.round(((g.edges.length / denom) - isolated.length / denom + depth / (denom + 1)) * 1e6) / 1e6 * 0.5 + 0.5 * (1 - isolated.length / denom));
  const conn = Math.max(0, Math.min(1, Math.round(connectivity * 1e6) / 1e6));
  const klass = classify(conn, cycles.length, isolated.length, g.nodes.length);
  const envelope: RuntimeMetaTopology = {
    class: klass,
    connectivity: conn,
    unstable: klass === 'UNSTABLE',
    collapsed: klass === 'COLLAPSED',
  };
  return deepFreeze(envelope);
}

export function isMetaTopologyStable(t: RuntimeMetaTransformation): boolean {
  const env = buildMetaTopology(t);
  return env.class === 'STABLE' && !env.unstable && !env.collapsed;
}

export const __meta_topology_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
