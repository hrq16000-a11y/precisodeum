import { UPSTREAM_LAYERS, type SponsorUpstreamLayerId } from './sponsorActivationInternals';

export interface SponsorActivationGraphNode {
  readonly id: string;
  readonly kind: 'upstream' | 'activation';
}

export interface SponsorActivationGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'readies';
}

export interface SponsorActivationReadinessGraph {
  readonly nodes: ReadonlyArray<SponsorActivationGraphNode>;
  readonly edges: ReadonlyArray<SponsorActivationGraphEdge>;
  readonly terminalNodeId: string;
}

export function resolveActivationGraph(): SponsorActivationReadinessGraph {
  const terminalNodeId = 'activation:governance';
  const nodes: SponsorActivationGraphNode[] = [];
  const edges: SponsorActivationGraphEdge[] = [];
  for (const layer of UPSTREAM_LAYERS) {
    nodes.push(Object.freeze({ id: `layer:${layer}`, kind: 'upstream' as const }));
    edges.push(Object.freeze({ from: `layer:${layer}`, to: terminalNodeId, relation: 'readies' as const }));
  }
  nodes.push(Object.freeze({ id: terminalNodeId, kind: 'activation' as const }));
  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    terminalNodeId,
  });
}

export type { SponsorUpstreamLayerId };
