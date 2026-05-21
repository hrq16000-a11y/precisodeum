/**
 * Phase 1.9.27 — Sponsor Replay Lineage.
 * Cumulative signed chain of replay frames across the timeline.
 */
import { deepFreeze, signObject } from './sponsorReplayInternals';
import type { SponsorReplayTimeline } from './sponsorReplayTimeline';

export interface SponsorReplayLineageEntry {
  readonly tick: number;
  readonly index: number;
  readonly tickSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorReplayLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorReplayLineageEntry>;
  readonly lineageSignature: string;
}

export function computeReplayLineage(timeline: SponsorReplayTimeline): SponsorReplayLineage {
  let prev = '';
  const entries: SponsorReplayLineageEntry[] = timeline.ticks.map((t, index) => {
    const cumulativeSignature = signObject({ prev, tick: t.tick, sig: t.tickSignature });
    prev = cumulativeSignature;
    return Object.freeze({
      tick: t.tick,
      index,
      tickSignature: t.tickSignature,
      cumulativeSignature,
    });
  });
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
  });
}
