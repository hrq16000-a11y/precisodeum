/**
 * Phase 1.9.27 — Sponsor Deterministic Replay Plane (public surface).
 */
export {
  SPONSOR_REPLAY_INTERNALS,
  SPONSOR_REPLAY_LAYER_ORDER,
  SPONSOR_REPLAY_LAYER_PHASE,
  SponsorReplayMutationError,
  SponsorReplayDeterminismError,
  SponsorReplayDriftError,
  type SponsorReplayLayerId,
} from './sponsorReplayInternals';

export {
  buildExecutionFrames,
  type SponsorReplayExecutionFrame,
  type SponsorReplayTickInput,
} from './sponsorReplayExecutionFrame';

export {
  generateReplayTimeline,
  type SponsorReplayTimeline,
  type SponsorReplayTimelineTick,
} from './sponsorReplayTimeline';

export {
  buildEquivalenceMatrix,
  type SponsorReplayEquivalenceMatrix,
  type SponsorReplayEquivalenceCell,
} from './sponsorReplayEquivalenceMatrix';

export {
  computeReplayLineage,
  type SponsorReplayLineage,
  type SponsorReplayLineageEntry,
} from './sponsorReplayLineage';

export {
  buildReplaySnapshot,
  type SponsorDeterministicReplaySnapshot,
} from './sponsorReplaySnapshot';

export {
  buildReplayEnvelope,
  lockReplayEnvelope,
  type SponsorReplayVerificationEnvelope,
} from './sponsorReplayVerificationEnvelope';

export {
  runReplayPlane,
  replayWorldState,
  reconstructHistoricalSnapshot,
  validateReplayEquivalence,
  assertReplayDeterminism,
  type SponsorReplayPlaneResult,
} from './sponsorDeterministicReplayPlane';
