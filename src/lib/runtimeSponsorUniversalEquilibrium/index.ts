/**
 * Phase 1.9.36 — Sponsor Universal Equilibrium Plane (public surface).
 */
export {
  SPONSOR_EQUILIBRIUM_INTERNALS,
  SPONSOR_EQUILIBRIUM_LAYER_ORDER,
  SPONSOR_EQUILIBRIUM_LAYER_PHASE,
  SPONSOR_EQUILIBRIUM_INVARIANTS,
  SponsorEquilibriumMutationError,
  SponsorEquilibriumDeterminismError,
  type SponsorEquilibriumLayerId,
  type SponsorEquilibriumInvariantId,
  type SponsorEquilibriumInvariantSpec,
} from './sponsorEquilibriumInternals';

export {
  generateEquilibriumInvariants,
  type SponsorEquilibriumInvariant,
  type SponsorEquilibriumInvariantRegistry,
} from './sponsorEquilibriumInvariants';

export {
  buildUniversalSaturationProofs,
  generateLayerDescriptors,
  type SponsorEquilibriumLayerDescriptor,
  type SponsorEquilibriumLayerInput,
  type SponsorUniversalSaturationProof,
  type SponsorUniversalSaturationProofs,
} from './sponsorUniversalSaturationProofs';

export {
  resolveEquilibriumGraph,
  type SponsorEquilibriumGraph,
  type SponsorEquilibriumNode,
  type SponsorEquilibriumEdge,
  type SponsorEquilibriumNodeKind,
  type SponsorEquilibriumEdgeKind,
} from './sponsorEquilibriumGraph';

export {
  computeSaturationLineage,
  type SponsorSaturationLineage,
  type SponsorSaturationLineageEntry,
} from './sponsorSaturationLineage';

export {
  generateEquilibriumSnapshot,
  type SponsorDeterministicEquilibriumSnapshot,
} from './sponsorEquilibriumSnapshot';

export {
  buildTerminalEquilibriumEnvelope,
  lockEquilibriumEnvelope,
  type SponsorTerminalEquilibriumEnvelope,
} from './sponsorTerminalEquilibriumEnvelope';

export {
  buildUniversalEquilibrium,
  assertEquilibriumDeterminism,
  type SponsorUniversalEquilibriumResult,
} from './sponsorUniversalEquilibriumPlane';
