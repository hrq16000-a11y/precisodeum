/**
 * Phase 1.9.28 — Sponsor Formal Verification Plane (public surface).
 */
export {
  SPONSOR_VERIFICATION_INTERNALS,
  SPONSOR_VERIFICATION_LAYER_ORDER,
  SPONSOR_VERIFICATION_LAYER_PHASE,
  SponsorVerificationMutationError,
  SponsorVerificationDeterminismError,
  SponsorInvariantViolationError,
  type SponsorVerificationLayerId,
} from './sponsorVerificationInternals';

export {
  buildInvariantRegistry,
  type SponsorInvariantRegistry,
  type SponsorInvariantDefinition,
  type SponsorInvariantSeverity,
} from './sponsorInvariantRegistry';

export {
  buildConsistencyProofs,
  hasCriticalViolation,
  type SponsorConsistencyProofs,
  type SponsorConsistencyProof,
  type SponsorProofVerdict,
  type SponsorVerificationLayerInput,
} from './sponsorConsistencyProofs';

export {
  generateVerificationMatrix,
  type SponsorVerificationMatrix,
  type SponsorVerificationMatrixCell,
} from './sponsorVerificationMatrix';

export {
  computeProofLineage,
  type SponsorProofLineage,
  type SponsorProofLineageEntry,
} from './sponsorProofLineage';

export {
  buildVerificationSnapshot,
  type SponsorDeterministicVerificationSnapshot,
} from './sponsorVerificationSnapshot';

export {
  buildProofEnvelope,
  lockProofEnvelope,
  type SponsorProofEnvelope,
} from './sponsorProofEnvelope';

export {
  runFormalVerificationPlane,
  verifySystemInvariants,
  validateCrossLayerEquivalence,
  assertNoCriticalViolations,
  assertVerificationDeterminism,
  type SponsorFormalVerificationResult,
} from './sponsorFormalVerificationPlane';
