import type {
  RuntimeNode,
  RuntimeNormalization,
  RuntimeNormalizationMode,
  RuntimeEdge,
} from './algebraTypes';

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function normalizeRuntimeState(node: RuntimeNode): RuntimeNode {
  const sortedAttrs: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(node.state.attributes).sort()) {
    sortedAttrs[k] = node.state.attributes[k];
  }
  return Object.freeze({
    ...node,
    state: Object.freeze({ ...node.state, attributes: Object.freeze(sortedAttrs) }),
  });
}

export function normalizeRuntimeEnvelope(
  nodes: readonly RuntimeNode[],
): readonly RuntimeNode[] {
  return Object.freeze(nodes.map(normalizeRuntimeState));
}

export function normalizeCanonicalGraph(g: {
  nodes: readonly RuntimeNode[];
  edges: readonly RuntimeEdge[];
}): { nodes: readonly RuntimeNode[]; edges: readonly RuntimeEdge[] } {
  const nodes = Object.freeze(
    [...g.nodes.map(normalizeRuntimeState)].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  );
  const edges = Object.freeze(
    [...g.edges].sort((a, b) =>
      a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1,
    ),
  );
  return { nodes, edges };
}

export function detectNormalizationConflict(
  nodes: readonly RuntimeNode[],
): readonly string[] {
  const conflicts: string[] = [];
  // Same node id appearing twice = conflict.
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.id, (counts.get(n.id) ?? 0) + 1);
  for (const [id, c] of counts) if (c > 1) conflicts.push(id);
  return Object.freeze(conflicts);
}

export function detectReductionFailure(
  before: number,
  after: number,
): boolean {
  return after > before;
}

export function classifyNormalization(
  conflicts: readonly string[],
  failure: boolean,
): RuntimeNormalizationMode {
  if (failure) return 'failed';
  if (conflicts.length > 0) return 'conflicted';
  return 'canonical';
}

export function buildNormalization(g: {
  nodes: readonly RuntimeNode[];
  edges: readonly RuntimeEdge[];
}): RuntimeNormalization {
  const conflicts = detectNormalizationConflict(g.nodes);
  const mode = classifyNormalization(conflicts, false);
  const serialized = JSON.stringify({
    nodes: g.nodes.map((n) => ({ id: n.id, layer: n.layer, sig: n.state })),
    edges: g.edges.map((e) => ({ f: e.from, t: e.to, m: e.mode })),
  });
  return Object.freeze({
    mode,
    canonicalHash: fnv1a(serialized),
    conflicts,
  });
}
