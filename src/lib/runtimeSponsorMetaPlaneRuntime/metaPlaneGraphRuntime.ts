/**
 * Phase 1.9.46 — Graph runtime (shared, read-only).
 */
import { deepFreeze } from './metaPlaneDeepFreeze';
import { signObject } from './metaPlaneFNV';

export interface CanonicalGraphNode {
  readonly id: string;
  readonly kind: string;
}

export interface CanonicalGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
}

export interface CanonicalGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<CanonicalGraphNode>;
  readonly edges: ReadonlyArray<CanonicalGraphEdge>;
  readonly graphSignature: string;
}

export function normalizeGraphEdges(
  edges: ReadonlyArray<CanonicalGraphEdge>,
): ReadonlyArray<CanonicalGraphEdge> {
  const sorted = [...edges]
    .map((e) => Object.freeze({ from: e.from, to: e.to, relation: e.relation }))
    .sort((a, b) => {
      const ka = `${a.from}\u0000${a.to}\u0000${a.relation}`;
      const kb = `${b.from}\u0000${b.to}\u0000${b.relation}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return Object.freeze(sorted);
}

export function buildCanonicalGraph(
  nodes: ReadonlyArray<CanonicalGraphNode>,
  edges: ReadonlyArray<CanonicalGraphEdge>,
): CanonicalGraph {
  const sortedNodes = [...nodes]
    .map((n) => Object.freeze({ id: n.id, kind: n.kind }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const normEdges = normalizeGraphEdges(edges);
  const graphSignature = signObject({ nodes: sortedNodes, edges: normEdges });
  return deepFreeze({
    version: 'v1' as const,
    nodes: Object.freeze(sortedNodes),
    edges: normEdges,
    graphSignature,
  });
}

export function signGraphPayload(graph: CanonicalGraph): string {
  return graph.graphSignature;
}
