/**
 * Phase 1.9.26 — Sponsor World Lineage.
 * Cumulative chain over the unified world state in canonical order.
 */
import {
  SPONSOR_WORLD_LAYER_ORDER,
  SPONSOR_WORLD_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorWorldLayerId,
} from './sponsorWorldInternals';
import type { SponsorUnifiedWorldState } from './sponsorUnifiedWorldState';

export interface SponsorWorldLineageEntry {
  readonly index: number;
  readonly layer: SponsorWorldLayerId;
  readonly phase: string;
  readonly signature: string | null;
  readonly cumulativeSignature: string;
}

export interface SponsorWorldLineage {
  readonly entries: ReadonlyArray<SponsorWorldLineageEntry>;
  readonly lineageSignature: string;
}

export function computeWorldLineage(world: SponsorUnifiedWorldState): SponsorWorldLineage {
  const byLayer = new Map(world.entries.map((e) => [e.layer, e]));
  let cumulative = '00000000';
  const entries: SponsorWorldLineageEntry[] = [];
  for (let i = 0; i < SPONSOR_WORLD_LAYER_ORDER.length; i++) {
    const layer = SPONSOR_WORLD_LAYER_ORDER[i];
    const e = byLayer.get(layer)!;
    cumulative = signObject({
      prev: cumulative,
      layer,
      phase: SPONSOR_WORLD_LAYER_PHASE[layer],
      signature: e.signature,
      entrySignature: e.entrySignature,
    });
    entries.push(
      Object.freeze({
        index: i,
        layer,
        phase: SPONSOR_WORLD_LAYER_PHASE[layer],
        signature: e.signature,
        cumulativeSignature: cumulative,
      }),
    );
  }
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({ entries: Object.freeze(entries), lineageSignature });
}
