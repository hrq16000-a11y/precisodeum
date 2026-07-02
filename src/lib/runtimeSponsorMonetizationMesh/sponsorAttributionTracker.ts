/**
 * Phase 1.9.14 — Attribution tracker. Builds lineage traces from exposures.
 * Lineage is deterministic and signed (FNV-1a).
 */
import type {
  SponsorAttributionTrace,
  SponsorEdge,
  SponsorExposureEvent,
} from './sponsorMeshTypes';
import { deepFreeze, signObject } from './sponsorMeshInternals';

function upstreamOf(
  sponsorId: string,
  edges: ReadonlyArray<SponsorEdge>,
  depth: number,
): ReadonlyArray<string> {
  const visited = new Set<string>([sponsorId]);
  const order: string[] = [];
  let frontier: string[] = [sponsorId];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of edges) {
        if (e.toId === id && !visited.has(e.fromId)) {
          visited.add(e.fromId);
          next.push(e.fromId);
          order.push(e.fromId);
        }
      }
    }
    frontier = next.sort();
  }
  return order;
}

export function buildAttributionTraces(
  exposures: ReadonlyArray<SponsorExposureEvent>,
  edges: ReadonlyArray<SponsorEdge>,
  depth = 2,
): ReadonlyArray<SponsorAttributionTrace> {
  const traces: SponsorAttributionTrace[] = exposures.map((ev) => {
    const lineage = upstreamOf(ev.sponsorId, edges, depth);
    const payload = {
      sponsorId: ev.sponsorId,
      slotId: ev.slotId,
      tick: ev.tick,
      lineage,
    };
    return deepFreeze({
      sponsorId: ev.sponsorId,
      slotId: ev.slotId,
      lineage,
      signature: signObject(payload),
    });
  });
  return deepFreeze(traces);
}
