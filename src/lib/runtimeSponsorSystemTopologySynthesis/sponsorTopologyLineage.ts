/**
 * Phase 1.9.25 — Sponsor Topology Lineage.
 * Reconstructs the structural lineage chain end-to-end in canonical order.
 */
import {
  SPONSOR_TOPOLOGY_LAYER_ORDER,
  SPONSOR_TOPOLOGY_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorTopologyLayerId,
} from './sponsorTopologyInternals';
import type { SponsorSystemTopologyGraph } from './sponsorSystemTopologyGraph';

export interface SponsorTopologyLineageEntry {
  readonly index: number;
  readonly layer: SponsorTopologyLayerId;
  readonly phase: string;
  readonly upstreamSignature: string | null;
  readonly cumulativeSignature: string;
}

export interface SponsorTopologyLineage {
  readonly entries: ReadonlyArray<SponsorTopologyLineageEntry>;
  readonly lineageSignature: string;
}

export function computeTopologyLineage(
  topology: SponsorSystemTopologyGraph,
): SponsorTopologyLineage {
  const byLayer = new Map(topology.nodes.map((n) => [n.layer, n]));
  const entries: SponsorTopologyLineageEntry[] = [];
  let cumulative = '00000000';

  for (let i = 0; i < SPONSOR_TOPOLOGY_LAYER_ORDER.length; i++) {
    const layer = SPONSOR_TOPOLOGY_LAYER_ORDER[i];
    const node = byLayer.get(layer)!;
    cumulative = signObject({
      prev: cumulative,
      layer,
      phase: SPONSOR_TOPOLOGY_LAYER_PHASE[layer],
      upstreamSignature: node.upstreamSignature,
      nodeSignature: node.nodeSignature,
    });
    entries.push(
      Object.freeze({
        index: i,
        layer,
        phase: SPONSOR_TOPOLOGY_LAYER_PHASE[layer],
        upstreamSignature: node.upstreamSignature,
        cumulativeSignature: cumulative,
      }),
    );
  }

  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({ entries: Object.freeze(entries), lineageSignature });
}
