/**
 * Phase 1.9.15 — Sponsor Decision Finalizer
 * Single source of truth for sponsor exposure decisions.
 * READ-ONLY / DETERMINISTIC / IMMUTABLE.
 */
export * from './sponsorDecisionModel';
export { normalizeDecisionInputs } from './sponsorDecisionNormalizer';
export { composeFinalScore, COMPOSITION_WEIGHTS } from './sponsorDecisionComposer';
export {
  emitDecisionTrace,
  type SponsorDecisionTraceEntry,
} from './sponsorDecisionTrace';
export {
  signSnapshotPayload,
  deepFreeze as sponsorDecisionDeepFreeze,
  assertSnapshotLocked,
  SponsorDecisionMutationError,
} from './sponsorDecisionSnapshot';
export {
  buildFinalDecision,
  resolveSlotAssignments,
  computeFinalRankingVector,
  lockDecisionSnapshot,
} from './sponsorDecisionFinalizer';
