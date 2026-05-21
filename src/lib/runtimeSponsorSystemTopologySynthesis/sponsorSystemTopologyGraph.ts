/**
 * Phase 1.9.25 — Sponsor System Topology Graph.
 * Pure structural representation of the system. No business logic.
 */
import {
  SPONSOR_TOPOLOGY_LAYER_ORDER,
  SPONSOR_TOPOLOGY_LAYER_PHASE,
  SPONSOR_TOPOLOGY_LAYER_PLANE,
  type SponsorTopologyLayerId,
  type SponsorTopologyPlane,
  deepFreeze,
  signObject,
} from './sponsorTopologyInternals';

/** Optional signature inputs per layer (read-only, signatures only). */
export interface SponsorTopologyLayerInput {
  readonly layer: SponsorTopologyLayerId;
  readonly signature?: string | null;
}

export interface SponsorTopologyNode {
  readonly id: SponsorTopologyLayerId;
  readonly layer: SponsorTopologyLayerId;
  readonly phase: string;
  readonly plane: SponsorTopologyPlane;
  readonly upstreamSignature: string | null;
  readonly nodeSignature: string;
}

export interface SponsorTopologyEdge {
  readonly from: SponsorTopologyLayerId;
  readonly to: SponsorTopologyLayerId;
  readonly kind: 'sequence' | 'observation' | 'control';
  readonly edgeSignature: string;
}

export interface SponsorSystemTopologyGraph {
  readonly nodes: ReadonlyArray<SponsorTopologyNode>;
  readonly edges: ReadonlyArray<SponsorTopologyEdge>;
  readonly graphSignature: string;
}

/**
 * Canonical edges across the system.
 * - sequence: engine + distribution pipeline (1.9.14 → 1.9.21)
 * - observation: audit observes the entire distribution pipeline
 * - control: governance + capability planes observe everything (read-only)
 */
function buildCanonicalEdges(): ReadonlyArray<Omit<SponsorTopologyEdge, 'edgeSignature'>> {
  const sequenceChain: SponsorTopologyLayerId[] = [
    'mesh',
    'decision',
    'campaign',
    'temporal',
    'contract',
    'api',
    'surface',
    'consistency',
  ];
  const edges: Array<Omit<SponsorTopologyEdge, 'edgeSignature'>> = [];

  // sequence edges
  for (let i = 0; i < sequenceChain.length - 1; i++) {
    edges.push({ from: sequenceChain[i], to: sequenceChain[i + 1], kind: 'sequence' });
  }
  // audit observes the full pipeline
  for (const l of sequenceChain) {
    edges.push({ from: l, to: 'audit', kind: 'observation' });
  }
  // control plane observes everything observable
  for (const l of [...sequenceChain, 'audit'] as SponsorTopologyLayerId[]) {
    edges.push({ from: l, to: 'governance', kind: 'control' });
    edges.push({ from: l, to: 'capability', kind: 'control' });
  }
  return edges;
}

export function buildSystemTopologyGraph(
  inputs: ReadonlyArray<SponsorTopologyLayerInput> = [],
): SponsorSystemTopologyGraph {
  const sigByLayer = new Map<SponsorTopologyLayerId, string | null>();
  for (const l of SPONSOR_TOPOLOGY_LAYER_ORDER) sigByLayer.set(l, null);
  for (const inp of inputs) {
    if (!SPONSOR_TOPOLOGY_LAYER_PHASE[inp.layer]) continue;
    sigByLayer.set(inp.layer, inp.signature ?? null);
  }

  const nodes: SponsorTopologyNode[] = SPONSOR_TOPOLOGY_LAYER_ORDER.map((layer) => {
    const upstreamSignature = sigByLayer.get(layer) ?? null;
    const phase = SPONSOR_TOPOLOGY_LAYER_PHASE[layer];
    const plane = SPONSOR_TOPOLOGY_LAYER_PLANE[layer];
    const nodeSignature = signObject({ layer, phase, plane, upstreamSignature });
    return Object.freeze({ id: layer, layer, phase, plane, upstreamSignature, nodeSignature });
  });

  const rawEdges = buildCanonicalEdges();
  const edges: SponsorTopologyEdge[] = rawEdges
    .map((e) => ({
      ...e,
      edgeSignature: signObject({ from: e.from, to: e.to, kind: e.kind }),
    }))
    .sort((a, b) => {
      if (a.from !== b.from) return a.from < b.from ? -1 : 1;
      if (a.to !== b.to) return a.to < b.to ? -1 : 1;
      return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
    })
    .map((e) => Object.freeze(e));

  const graphSignature = signObject({
    nodes: nodes.map((n) => n.nodeSignature),
    edges: edges.map((e) => e.edgeSignature),
  });

  return deepFreeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    graphSignature,
  });
}
