/**
 * Phase 1.9.35 — Sponsor Terminal Coherence Plane (public surface).
 */
export {
  SPONSOR_COHERENCE_INTERNALS,
  SPONSOR_COHERENCE_LAYER_ORDER,
  SPONSOR_COHERENCE_LAYER_PHASE,
  SPONSOR_COHERENCE_INVARIANTS,
  SponsorCoherenceMutationError,
  SponsorCoherenceDeterminismError,
  type SponsorCoherenceLayerId,
  type SponsorCoherenceInvariantId,
  type SponsorCoherenceInvariantSpec,
} from './sponsorCoherenceInternals';

export {
  generateCoherenceInvariants,
  type SponsorCoherenceInvariant,
  type SponsorCoherenceInvariantRegistry,
} from './sponsorCoherenceInvariants';

export {
  buildOntologicalCompletenessProofs,
  generateLayerDescriptors,
  type SponsorCoherenceLayerDescriptor,
  type SponsorCoherenceLayerInput,
  type SponsorOntologicalCompletenessProof,
  type SponsorOntologicalCompletenessProofs,
} from './sponsorOntologicalCompletenessProofs';

export {
  resolveCompletenessGraph,
  type SponsorCompletenessGraph,
  type SponsorCompletenessNode,
  type SponsorCompletenessEdge,
  type SponsorCompletenessNodeKind,
  type SponsorCompletenessEdgeKind,
} from './sponsorCompletenessGraph';

export {
  computeCompletenessLineage,
  type SponsorCompletenessLineage,
  type SponsorCompletenessLineageEntry,
} from './sponsorCompletenessLineage';

export {
  generateCoherenceSnapshot,
  type SponsorDeterministicCoherenceSnapshot,
} from './sponsorCoherenceSnapshot';

export {
  buildTerminalCoherenceEnvelope,
  lockCoherenceEnvelope,
  type SponsorTerminalCoherenceEnvelope,
} from './sponsorTerminalCoherenceEnvelope';

export {
  buildTerminalCoherence,
  assertCoherenceDeterminism,
  type SponsorTerminalCoherenceResult,
} from './sponsorTerminalCoherencePlane';
