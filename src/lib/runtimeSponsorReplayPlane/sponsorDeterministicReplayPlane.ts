/**
 * Phase 1.9.27 — Sponsor Deterministic Replay Plane.
 * Top-level orchestrator. Reconstructs, replays, and verifies historical
 * world snapshots / topology / governance / capability / API / contracts /
 * surface / consistency / audit / temporal / decision / mesh signatures.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorReplayDeterminismError } from './sponsorReplayInternals';
import {
  generateReplayTimeline,
  type SponsorReplayTimeline,
} from './sponsorReplayTimeline';
import {
  buildEquivalenceMatrix,
  type SponsorReplayEquivalenceMatrix,
} from './sponsorReplayEquivalenceMatrix';
import { computeReplayLineage, type SponsorReplayLineage } from './sponsorReplayLineage';
import {
  buildReplaySnapshot,
  type SponsorDeterministicReplaySnapshot,
} from './sponsorReplaySnapshot';
import {
  buildReplayEnvelope,
  lockReplayEnvelope,
  type SponsorReplayVerificationEnvelope,
} from './sponsorReplayVerificationEnvelope';
import type { SponsorReplayTickInput } from './sponsorReplayExecutionFrame';

export interface SponsorReplayPlaneResult {
  readonly timeline: SponsorReplayTimeline;
  readonly matrix: SponsorReplayEquivalenceMatrix;
  readonly lineage: SponsorReplayLineage;
  readonly snapshot: SponsorDeterministicReplaySnapshot;
  readonly envelope: SponsorReplayVerificationEnvelope;
}

export function runReplayPlane(
  inputs: ReadonlyArray<SponsorReplayTickInput> = [],
): SponsorReplayPlaneResult {
  const timeline = generateReplayTimeline(inputs);
  const matrix = buildEquivalenceMatrix(timeline);
  const lineage = computeReplayLineage(timeline);
  const snapshot = buildReplaySnapshot(timeline, matrix);
  const envelope = buildReplayEnvelope(timeline, matrix, lineage, snapshot);
  lockReplayEnvelope(envelope);
  return Object.freeze({ timeline, matrix, lineage, snapshot, envelope });
}

export function replayWorldState(
  inputs: ReadonlyArray<SponsorReplayTickInput>,
): SponsorReplayVerificationEnvelope {
  return runReplayPlane(inputs).envelope;
}

export function reconstructHistoricalSnapshot(
  inputs: ReadonlyArray<SponsorReplayTickInput>,
  tick: number,
): SponsorReplayTimeline['ticks'][number] | null {
  const { timeline } = runReplayPlane(inputs);
  return timeline.ticks.find((t) => t.tick === tick) ?? null;
}

export function validateReplayEquivalence(
  a: SponsorReplayVerificationEnvelope,
  b: SponsorReplayVerificationEnvelope,
): boolean {
  return a.envelopeSignature === b.envelopeSignature;
}

export function assertReplayDeterminism(
  a: SponsorReplayVerificationEnvelope,
  b: SponsorReplayVerificationEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorReplayDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.timeline.timelineSignature !== b.timeline.timelineSignature) {
    throw new SponsorReplayDeterminismError('timeline signature drift');
  }
  if (a.matrix.matrixSignature !== b.matrix.matrixSignature) {
    throw new SponsorReplayDeterminismError('matrix signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorReplayDeterminismError('lineage signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorReplayDeterminismError('snapshot signature drift');
  }
}
