import { reduceEquivalentStructures } from './runtimeEquivalence';
import type {
  RuntimeEdge,
  RuntimeNode,
  RuntimeReduction,
  RuntimeReductionMode,
} from './algebraTypes';

export function reduceCanonicalState(
  nodes: readonly RuntimeNode[],
  edges: readonly RuntimeEdge[],
): { nodes: readonly RuntimeNode[]; edges: readonly RuntimeEdge[] } {
  const reducedNodes = reduceEquivalentStructures(nodes);
  const keep = new Set(reducedNodes.map((n) => n.id));
  const reducedEdges = edges.filter((e) => keep.has(e.from) && keep.has(e.to));
  return { nodes: Object.freeze(reducedNodes), edges: Object.freeze(reducedEdges) };
}

export function reduceEquivalentNodes(
  nodes: readonly RuntimeNode[],
): readonly RuntimeNode[] {
  return reduceEquivalentStructures(nodes);
}

export function reducePropagationChains(
  edges: readonly RuntimeEdge[],
): readonly RuntimeEdge[] {
  const map = new Map<string, RuntimeEdge>();
  for (const e of edges) {
    const k = `${e.from}>${e.to}`;
    const cur = map.get(k);
    if (!cur || cur.weight < e.weight) map.set(k, e);
  }
  return Object.freeze(Array.from(map.values()));
}

export function reduceTopologyComplexity(
  nodes: readonly RuntimeNode[],
  edges: readonly RuntimeEdge[],
): { nodes: readonly RuntimeNode[]; edges: readonly RuntimeEdge[] } {
  const noOrphans = nodes.filter((n) => !n.orphan);
  return {
    nodes: Object.freeze(noOrphans),
    edges: reducePropagationChains(edges),
  };
}

export function calculateReductionGain(original: number, reduced: number): number {
  if (original <= 0) return 0;
  if (reduced > original) return 0;
  return Math.max(0, Math.min(1, (original - reduced) / original));
}

export function classifyReductionHealth(args: {
  originalNodes: number;
  reducedNodes: number;
  gain: number;
  equivalenceMismatch: boolean;
  recursive: boolean;
}): RuntimeReductionMode {
  if (args.recursive) return 'recursive';
  if (args.reducedNodes > args.originalNodes) return 'unstable';
  if (args.gain >= 0.5) return 'fully_reduced';
  if (args.gain > 0) return 'partially_reduced';
  return 'irreducible';
}

export function buildReduction(
  nodes: readonly RuntimeNode[],
  edges: readonly RuntimeEdge[],
): RuntimeReduction {
  const { nodes: reducedNodes } = reduceCanonicalState(nodes, edges);
  const gain = calculateReductionGain(nodes.length, reducedNodes.length);
  const recursive = nodes.some((n) => n.recursive);
  const mode = classifyReductionHealth({
    originalNodes: nodes.length,
    reducedNodes: reducedNodes.length,
    gain,
    equivalenceMismatch: false,
    recursive,
  });
  return Object.freeze({
    mode,
    originalNodes: nodes.length,
    reducedNodes: reducedNodes.length,
    gain,
    equivalenceMismatch: false,
  });
}
