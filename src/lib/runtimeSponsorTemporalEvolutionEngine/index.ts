/**
 * Phase 1.9.17 — Sponsor Temporal Evolution Engine.
 * READ-ONLY / DETERMINISTIC / NON-DECISIONAL.
 */
export * from './sponsorTemporalModel';
export {
  signTemporalPayload,
  deepFreeze as sponsorTemporalDeepFreeze,
  assertTemporalSnapshotLocked,
  clamp01 as sponsorTemporalClamp01,
  intPow as sponsorTemporalIntPow,
} from './sponsorTemporalSnapshot';
export { applyExposureDecayVector, resolveDecayPerTick } from './sponsorTemporalDecay';
export { computePacingWindow, resolvePacingWindowSize } from './sponsorTemporalPacing';
export {
  buildTemporalSnapshot,
  projectFutureState,
  lockTemporalFrame,
} from './sponsorTemporalEvolutionEngine';
export {
  correlateDecisionWithTemporalFrames,
  listFramesByLifecycle,
} from './sponsorTemporalResolver';
