/**
 * Phase 1.9.27 — Sponsor Replay Timeline.
 * Canonical, deterministic timeline of replay frames across ticks.
 */
import { deepFreeze, signObject } from './sponsorReplayInternals';
import {
  buildExecutionFrames,
  type SponsorReplayExecutionFrame,
  type SponsorReplayTickInput,
} from './sponsorReplayExecutionFrame';

export interface SponsorReplayTimelineTick {
  readonly tick: number;
  readonly frames: ReadonlyArray<SponsorReplayExecutionFrame>;
  readonly tickSignature: string;
}

export interface SponsorReplayTimeline {
  readonly version: 'v1';
  readonly ticks: ReadonlyArray<SponsorReplayTimelineTick>;
  readonly timelineSignature: string;
}

export function generateReplayTimeline(
  inputs: ReadonlyArray<SponsorReplayTickInput> = [],
): SponsorReplayTimeline {
  // Canonical: sort by tick asc (stable for equal ticks via index).
  const sorted = [...inputs].sort((a, b) => a.tick - b.tick);
  const ticks: SponsorReplayTimelineTick[] = sorted.map((input) => {
    const frames = buildExecutionFrames(input);
    const tickSignature = signObject(frames.map((f) => f.frameSignature));
    return Object.freeze({ tick: input.tick, frames, tickSignature });
  });
  const timelineSignature = signObject(ticks.map((t) => [t.tick, t.tickSignature]));
  return deepFreeze({
    version: 'v1' as const,
    ticks: Object.freeze(ticks),
    timelineSignature,
  });
}
