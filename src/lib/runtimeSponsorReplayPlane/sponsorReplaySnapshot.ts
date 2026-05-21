/**
 * Phase 1.9.27 — Sponsor Replay Snapshot.
 * Deterministic structural snapshot of a replay execution.
 */
import { deepFreeze, signObject } from './sponsorReplayInternals';
import type { SponsorReplayTimeline } from './sponsorReplayTimeline';
import type { SponsorReplayEquivalenceMatrix } from './sponsorReplayEquivalenceMatrix';

export interface SponsorDeterministicReplaySnapshot {
  readonly version: 'v1';
  readonly tickCount: number;
  readonly frameCount: number;
  readonly timelineSignature: string;
  readonly matrixSignature: string;
  readonly snapshotSignature: string;
}

export function buildReplaySnapshot(
  timeline: SponsorReplayTimeline,
  matrix: SponsorReplayEquivalenceMatrix,
): SponsorDeterministicReplaySnapshot {
  const frameCount = timeline.ticks.reduce((acc, t) => acc + t.frames.length, 0);
  const snapshotSignature = signObject({
    timeline: timeline.timelineSignature,
    matrix: matrix.matrixSignature,
    tickCount: timeline.ticks.length,
    frameCount,
  });
  return deepFreeze({
    version: 'v1' as const,
    tickCount: timeline.ticks.length,
    frameCount,
    timelineSignature: timeline.timelineSignature,
    matrixSignature: matrix.matrixSignature,
    snapshotSignature,
  });
}
