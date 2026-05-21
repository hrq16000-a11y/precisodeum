/**
 * Phase 1.9.27 — Sponsor Replay Verification Envelope.
 * Locked, frozen, deterministic artifact wrapping the entire replay plane.
 */
import {
  SPONSOR_REPLAY_INTERNALS,
  SponsorReplayMutationError,
  deepFreeze,
  signObject,
} from './sponsorReplayInternals';
import type { SponsorReplayTimeline } from './sponsorReplayTimeline';
import type { SponsorReplayEquivalenceMatrix } from './sponsorReplayEquivalenceMatrix';
import type { SponsorReplayLineage } from './sponsorReplayLineage';
import type { SponsorDeterministicReplaySnapshot } from './sponsorReplaySnapshot';

export interface SponsorReplayVerificationEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly timeline: SponsorReplayTimeline;
  readonly matrix: SponsorReplayEquivalenceMatrix;
  readonly lineage: SponsorReplayLineage;
  readonly snapshot: SponsorDeterministicReplaySnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildReplayEnvelope(
  timeline: SponsorReplayTimeline,
  matrix: SponsorReplayEquivalenceMatrix,
  lineage: SponsorReplayLineage,
  snapshot: SponsorDeterministicReplaySnapshot,
): SponsorReplayVerificationEnvelope {
  const envelopeSignature = signObject({
    timeline: timeline.timelineSignature,
    matrix: matrix.matrixSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_REPLAY_INTERNALS.stage,
    timeline,
    matrix,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockReplayEnvelope(env: SponsorReplayVerificationEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorReplayMutationError('envelope must be frozen and locked');
  }
}
