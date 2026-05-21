/**
 * Phase 1.9.32 — Sponsor Closure Theorem Graph.
 * Deterministic node-edge graph binding theorems → layers → canonical sequence.
 */
import {
  SPONSOR_CLOSURE_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorClosureLayerId,
  type SponsorConsistencyTheoremId,
} from './sponsorClosureInternals';
import type { SponsorConsistencyTheoremRegistry } from './sponsorConsistencyTheorems';
import type {
  SponsorClosureLayerDescriptor,
  SponsorTerminalConsistencyProofs,
} from './sponsorTerminalConsistencyProofs';

export type SponsorClosureNodeKind = 'theorem' | 'layer';
export type SponsorClosureEdgeKind = 'sequence' | 'certifies';

export interface SponsorClosureNode {
  readonly id: string;
  readonly kind: SponsorClosureNodeKind;
  readonly label: string;
}

export interface SponsorClosureEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorClosureEdgeKind;
}

export interface SponsorClosureTheoremGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorClosureNode>;
  readonly edges: ReadonlyArray<SponsorClosureEdge>;
  readonly graphSignature: string;
}

export function resolveClosureTheoremGraph(
  registry: SponsorConsistencyTheoremRegistry,
  proofs: SponsorTerminalConsistencyProofs,
): SponsorClosureTheoremGraph {
  const nodes: SponsorClosureNode[] = [];
  for (const t of registry.theorems) {
    nodes.push(Object.freeze({ id: `theorem:${t.id}`, kind: 'theorem', label: t.title }));
  }
  for (const d of proofs.descriptors) {
    nodes.push(Object.freeze({ id: `layer:${d.id}`, kind: 'layer', label: `${d.phase}:${d.id}` }));
  }
  const sortedNodes = Object.freeze([...nodes].sort((a, b) => a.id.localeCompare(b.id)));

  const edges: SponsorClosureEdge[] = [];
  // sequence edges
  for (let i = 0; i < SPONSOR_CLOSURE_LAYER_ORDER.length - 1; i++) {
    edges.push(
      Object.freeze({
        from: `layer:${SPONSOR_CLOSURE_LAYER_ORDER[i]}`,
        to: `layer:${SPONSOR_CLOSURE_LAYER_ORDER[i + 1]}`,
        kind: 'sequence',
      }),
    );
  }
  // certifies edges (every theorem certifies every layer)
  const theoremIds: ReadonlyArray<SponsorConsistencyTheoremId> = registry.theorems.map((t) => t.id);
  const layerIds: ReadonlyArray<SponsorClosureLayerId> = proofs.descriptors.map((d) => d.id);
  for (const tid of theoremIds) {
    for (const lid of layerIds) {
      edges.push(
        Object.freeze({ from: `theorem:${tid}`, to: `layer:${lid}`, kind: 'certifies' }),
      );
    }
  }
  const sortedEdges = Object.freeze(
    [...edges].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      return a.to.localeCompare(b.to);
    }),
  );

  const graphSignature = signObject({
    nodes: sortedNodes.map((n) => `${n.id}|${n.kind}|${n.label}`),
    edges: sortedEdges.map((e) => `${e.from}>${e.to}:${e.kind}`),
  });

  return deepFreeze({
    version: 'v1' as const,
    nodes: sortedNodes,
    edges: sortedEdges,
    graphSignature,
  });
}
