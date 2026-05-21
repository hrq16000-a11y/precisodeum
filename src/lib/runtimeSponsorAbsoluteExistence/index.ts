/**
 * Phase 1.9.34 — Sponsor Absolute Existence Plane (public surface).
 */
export {
  SPONSOR_EXISTENCE_INTERNALS,
  SPONSOR_EXISTENCE_LAYER_ORDER,
  SPONSOR_EXISTENCE_LAYER_PHASE,
  SPONSOR_EXISTENCE_INVARIANTS,
  SponsorExistenceMutationError,
  SponsorExistenceDeterminismError,
  type SponsorExistenceLayerId,
  type SponsorExistenceInvariantId,
  type SponsorExistenceInvariantSpec,
} from './sponsorExistenceInternals';

export {
  generateExistenceIdentity,
  type SponsorAbsoluteIdentity,
  type SponsorAbsoluteIdentityInput,
  type SponsorAbsoluteIdentityNode,
} from './sponsorAbsoluteIdentity';

export {
  buildExistenceInvariants,
  type SponsorExistenceInvariant,
  type SponsorExistenceInvariantRegistry,
} from './sponsorExistenceInvariants';

export {
  resolveOntologyGraph,
  type SponsorOntologyGraph,
  type SponsorOntologyNode,
  type SponsorOntologyEdge,
  type SponsorOntologyNodeKind,
  type SponsorOntologyEdgeKind,
} from './sponsorOntologyGraph';

export {
  computeOntologyLineage,
  type SponsorOntologyLineage,
  type SponsorOntologyLineageEntry,
} from './sponsorOntologyLineage';

export {
  generateExistenceSnapshot,
  type SponsorDeterministicExistenceSnapshot,
} from './sponsorExistenceSnapshot';

export {
  buildExistenceCertificationEnvelope,
  lockExistenceEnvelope,
  type SponsorExistenceCertificationEnvelope,
} from './sponsorExistenceCertificationEnvelope';

export {
  buildAbsoluteExistence,
  assertExistenceDeterminism,
  type SponsorAbsoluteExistenceResult,
} from './sponsorAbsoluteExistencePlane';
