/**
 * Phase 1.9.14 — Sponsor graph builder. Pure structural composition.
 */
import type {
  SponsorEdge,
  SponsorNode,
  SponsorMeshSnapshot,
  SponsorAllocationPolicy,
  SponsorExposureEvent,
  SponsorSlot,
} from './sponsorMeshTypes';
import { SPONSOR_MESH_INTERNALS, deepFreeze, signObject } from './sponsorMeshInternals';

export function buildSponsorEdges(nodes: ReadonlyArray<SponsorNode>): ReadonlyArray<SponsorEdge> {
  const edges: SponsorEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.city === b.city) {
        edges.push(deepFreeze({ fromId: a.id, toId: b.id, relation: 'co_city', weight: 0.5 }));
      }
      if (a.category === b.category) {
        edges.push(deepFreeze({ fromId: a.id, toId: b.id, relation: 'co_category', weight: 0.7 }));
      }
    }
  }
  edges.sort((a, b) =>
    a.fromId.localeCompare(b.fromId) ||
    a.toId.localeCompare(b.toId) ||
    a.relation.localeCompare(b.relation),
  );
  return deepFreeze(edges);
}

export function buildSponsorMeshSnapshot(
  nodes: ReadonlyArray<SponsorNode>,
  slots: ReadonlyArray<SponsorSlot>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  policy: SponsorAllocationPolicy,
): SponsorMeshSnapshot {
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedSlots = [...slots].sort((a, b) => a.id.localeCompare(b.id));
  const sortedExposures = [...exposures].sort(
    (a, b) => a.tick - b.tick || a.slotId.localeCompare(b.slotId),
  );
  const edges = buildSponsorEdges(sortedNodes);
  const signature = signObject({
    nodes: sortedNodes,
    edges,
    slots: sortedSlots,
    exposures: sortedExposures,
    policy,
  });
  return deepFreeze({
    nodes: sortedNodes,
    edges,
    slots: sortedSlots,
    exposures: sortedExposures,
    policy,
    signature,
    internals: SPONSOR_MESH_INTERNALS,
  });
}

/** Static deterministic skeleton — equivalent of sponsorGraph.json (read-only). */
export const SPONSOR_GRAPH_SKELETON = deepFreeze({
  version: '1.9.14',
  stage: 'STAGE_0_READ_ONLY' as const,
  nodes: [] as ReadonlyArray<SponsorNode>,
  edges: [] as ReadonlyArray<SponsorEdge>,
  slots: [] as ReadonlyArray<SponsorSlot>,
});
