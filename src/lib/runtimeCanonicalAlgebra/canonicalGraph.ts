import type {
  CanonicalLayer,
  RuntimeEdge,
  RuntimeNode,
  RuntimeState,
  RuntimeAlgebraTopology,
  RuntimeCanonicalStateClass,
} from './algebraTypes';

export interface RawCanonicalInput {
  readonly states: readonly RuntimeState[];
  readonly edges?: readonly RuntimeEdge[];
}

function isSafeState(s: RuntimeState): boolean {
  return (
    !s.liveExecutionEnabled &&
    !s.retryEnabled &&
    !s.backgroundEnabled &&
    !s.realUsersAllowed &&
    s.stage === 'STAGE_0_READ_ONLY'
  );
}

function classifyNodeState(s: RuntimeState): RuntimeCanonicalStateClass {
  if (!isSafeState(s)) return 'divergent';
  return s.classification;
}

export function buildCanonicalGraph(input: RawCanonicalInput): {
  nodes: readonly RuntimeNode[];
  edges: readonly RuntimeEdge[];
} {
  const states = [...input.states].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const edges = [...(input.edges ?? [])];
  const inMap = new Map<string, number>();
  const outMap = new Map<string, number>();
  const idSet = new Set(states.map((s) => s.id));

  for (const e of edges) {
    outMap.set(e.from, (outMap.get(e.from) ?? 0) + 1);
    inMap.set(e.to, (inMap.get(e.to) ?? 0) + 1);
  }

  const sigCounts = new Map<string, number>();
  for (const s of states) {
    const sig = `${s.layer}|${s.stage}|${JSON.stringify(s.attributes)}`;
    sigCounts.set(sig, (sigCounts.get(sig) ?? 0) + 1);
  }

  const nodes: RuntimeNode[] = states.map((s) => {
    const sig = `${s.layer}|${s.stage}|${JSON.stringify(s.attributes)}`;
    const recursive = edges.some((e) => e.from === s.id && e.to === s.id);
    const inDeg = inMap.get(s.id) ?? 0;
    const outDeg = outMap.get(s.id) ?? 0;
    return Object.freeze<RuntimeNode>({
      id: s.id,
      layer: s.layer,
      state: Object.freeze({ ...s, classification: classifyNodeState(s) }),
      inDegree: inDeg,
      outDegree: outDeg,
      orphan: inDeg === 0 && outDeg === 0,
      redundant: (sigCounts.get(sig) ?? 0) > 1,
      recursive,
    });
  });

  const cleanEdges = edges
    .filter((e) => idSet.has(e.from) && idSet.has(e.to))
    .map((e) =>
      Object.freeze<RuntimeEdge>({
        from: e.from,
        to: e.to,
        mode: e.mode,
        weight: Math.max(0, Math.min(1, e.weight)),
        recursive: e.from === e.to || e.recursive,
      }),
    )
    .sort((a, b) =>
      a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1,
    );

  return { nodes: Object.freeze(nodes), edges: Object.freeze(cleanEdges) };
}

export function normalizeRuntimeGraph(g: {
  nodes: readonly RuntimeNode[];
  edges: readonly RuntimeEdge[];
}): { nodes: readonly RuntimeNode[]; edges: readonly RuntimeEdge[] } {
  return {
    nodes: Object.freeze(
      [...g.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    ),
    edges: Object.freeze(
      [...g.edges].sort((a, b) =>
        a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1,
      ),
    ),
  };
}

export function reduceRuntimeGraph(g: {
  nodes: readonly RuntimeNode[];
  edges: readonly RuntimeEdge[];
}): { nodes: readonly RuntimeNode[]; edges: readonly RuntimeEdge[] } {
  const seenSig = new Set<string>();
  const kept: RuntimeNode[] = [];
  for (const n of g.nodes) {
    const sig = `${n.layer}|${n.state.stage}|${JSON.stringify(n.state.attributes)}`;
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);
    kept.push(n);
  }
  const keptIds = new Set(kept.map((n) => n.id));
  const reducedEdges = g.edges.filter((e) => keptIds.has(e.from) && keptIds.has(e.to));
  return { nodes: Object.freeze(kept), edges: Object.freeze(reducedEdges) };
}

export function freezeCanonicalGraph<T extends object>(g: T): T {
  return Object.freeze(g);
}

function findCycles(
  nodes: readonly RuntimeNode[],
  edges: readonly RuntimeEdge[],
): readonly (readonly string[])[] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const cycles: string[][] = [];
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function dfs(u: string) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === WHITE) dfs(v);
      else if (c === GRAY) {
        const idx = stack.indexOf(v);
        if (idx >= 0) cycles.push([...stack.slice(idx), v]);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  }

  for (const n of nodes) if ((color.get(n.id) ?? WHITE) === WHITE) dfs(n.id);
  return cycles;
}

export function classifyGraphTopology(g: {
  nodes: readonly RuntimeNode[];
  edges: readonly RuntimeEdge[];
}): RuntimeAlgebraTopology {
  const cycles = findCycles(g.nodes, g.edges);
  const recursive = g.nodes.some((n) => n.recursive) || cycles.length > 0;
  const collapsed = g.nodes.length === 0 && g.edges.length > 0;
  let state: RuntimeAlgebraTopology['state'];
  if (collapsed) state = 'collapsed';
  else if (cycles.length > 0) state = 'circular';
  else if (recursive) state = 'recursive';
  else if (g.edges.length > g.nodes.length * 2) state = 'overlapping';
  else state = 'stable';
  return Object.freeze({ state, cycles, recursive, collapsed });
}

export function classifyCanonicalState(
  nodes: readonly RuntimeNode[],
  topology: RuntimeAlgebraTopology,
): RuntimeCanonicalStateClass {
  if (nodes.some((n) => n.state.classification === 'divergent')) return 'divergent';
  if (topology.collapsed) return 'divergent';
  if (topology.cycles.length > 0 || topology.recursive) return 'unstable';
  if (nodes.some((n) => n.redundant)) return 'reducible';
  if (nodes.every((n) => n.state.classification === 'canonical')) return 'canonical';
  return 'normalized';
}

export function layersOf(nodes: readonly RuntimeNode[]): readonly CanonicalLayer[] {
  const set = new Set<CanonicalLayer>();
  for (const n of nodes) set.add(n.layer);
  return Object.freeze([...set]);
}
