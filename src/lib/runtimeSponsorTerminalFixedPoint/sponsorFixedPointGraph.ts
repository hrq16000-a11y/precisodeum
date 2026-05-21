/**
 * Phase 1.9.33 — Sponsor Fixed-Point Graph.
 * Deterministic node-edge graph: consensus → layers → canonical sequence + self-loop fixed-point.
 */
import {
  SPONSOR_FIXED_POINT_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorFixedPointConsensusId,
  type SponsorFixedPointLayerId,
} from './sponsorFixedPointInternals';
import type { SponsorFixedPointConsensusRegistry } from './sponsorFixedPointConsensus';
import type {
  SponsorFixedPointLayerDescriptor,
  SponsorTerminalImmutabilityProofs,
} from './sponsorTerminalImmutabilityProofs';

export type SponsorFixedPointNodeKind = 'consensus' | 'layer' | 'terminal';
export type SponsorFixedPointEdgeKind = 'sequence' | 'converges' | 'fixed-point';

export interface SponsorFixedPointNode {
  readonly id: string;
  readonly kind: SponsorFixedPointNodeKind;
  readonly label: string;
}

export interface SponsorFixedPointEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorFixedPointEdgeKind;
}

export interface SponsorFixedPointGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorFixedPointNode>;
  readonly edges: ReadonlyArray<SponsorFixedPointEdge>;
  readonly graphSignature: string;
}

const TERMINAL_NODE_ID = 'terminal:fixed-point';

export function resolveFixedPointGraph(
  registry: SponsorFixedPointConsensusRegistry,
  proofs: SponsorTerminalImmutabilityProofs,
): SponsorFixedPointGraph {
  const nodes: SponsorFixedPointNode[] = [];
  nodes.push(Object.freeze({ id: TERMINAL_NODE_ID, kind: 'terminal', label: 'Terminal Fixed-Point' }));
  for (const c of registry.consensus) {
    nodes.push(Object.freeze({ id: `consensus:${c.id}`, kind: 'consensus', label: c.title }));
  }
  for (const d of proofs.descriptors) {
    nodes.push(
      Object.freeze({ id: `layer:${d.id}`, kind: 'layer', label: `${d.phase}:${d.id}` }),
    );
  }
  const sortedNodes = Object.freeze([...nodes].sort((a, b) => a.id.localeCompare(b.id)));

  const edges: SponsorFixedPointEdge[] = [];
  for (let i = 0; i < SPONSOR_FIXED_POINT_LAYER_ORDER.length - 1; i++) {
    edges.push(
      Object.freeze({
        from: `layer:${SPONSOR_FIXED_POINT_LAYER_ORDER[i]}`,
        to: `layer:${SPONSOR_FIXED_POINT_LAYER_ORDER[i + 1]}`,
        kind: 'sequence',
      }),
    );
  }
  const consensusIds: ReadonlyArray<SponsorFixedPointConsensusId> = registry.consensus.map(
    (c) => c.id,
  );
  const layerIds: ReadonlyArray<SponsorFixedPointLayerId> = proofs.descriptors.map((d) => d.id);
  for (const cid of consensusIds) {
    for (const lid of layerIds) {
      edges.push(
        Object.freeze({ from: `consensus:${cid}`, to: `layer:${lid}`, kind: 'converges' }),
      );
    }
  }
  for (const lid of layerIds) {
    edges.push(Object.freeze({ from: `layer:${lid}`, to: TERMINAL_NODE_ID, kind: 'converges' }));
  }
  edges.push(Object.freeze({ from: TERMINAL_NODE_ID, to: TERMINAL_NODE_ID, kind: 'fixed-point' }));

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
