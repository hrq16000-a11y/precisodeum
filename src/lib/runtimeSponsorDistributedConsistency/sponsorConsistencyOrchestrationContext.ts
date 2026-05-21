/**
 * Phase 1.9.21 — Sponsor Distributed Consistency · Orchestration context.
 * Pure data describing a logical multi-node execution frame.
 */
import type { SponsorEdgeConsistencyEnvelope } from '@/lib/runtimeSponsorProductSurfaceStabilization';

export type SponsorGlobalNodeRegion =
  | 'edge-na'
  | 'edge-sa'
  | 'edge-eu'
  | 'edge-ap'
  | 'edge-local';

export interface SponsorGlobalConsistencyNode {
  readonly nodeId: string;
  readonly nodeRegion: SponsorGlobalNodeRegion;
  /** Ordering hint only — never mutates output. */
  readonly orderingIndex: number;
}

export interface SponsorConsistencyOrchestrationContext {
  readonly orchestrationId: string;
  readonly nodes: ReadonlyArray<SponsorGlobalConsistencyNode>;
  readonly envelopes: ReadonlyArray<{
    readonly node: SponsorGlobalConsistencyNode;
    readonly envelope: SponsorEdgeConsistencyEnvelope;
  }>;
}

export function createConsistencyOrchestrationContext(
  orchestrationId: string,
  pairs: ReadonlyArray<{
    node: SponsorGlobalConsistencyNode;
    envelope: SponsorEdgeConsistencyEnvelope;
  }>,
): SponsorConsistencyOrchestrationContext {
  // Deterministic ordering: by orderingIndex then nodeId.
  const sorted = [...pairs].sort((a, b) => {
    if (a.node.orderingIndex !== b.node.orderingIndex) {
      return a.node.orderingIndex - b.node.orderingIndex;
    }
    return a.node.nodeId.localeCompare(b.node.nodeId);
  });
  const nodes = sorted.map((p) => p.node);
  return Object.freeze({
    orchestrationId,
    nodes: Object.freeze(nodes),
    envelopes: Object.freeze(
      sorted.map((p) => Object.freeze({ node: p.node, envelope: p.envelope })),
    ),
  });
}
