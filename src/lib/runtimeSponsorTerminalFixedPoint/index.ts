/**
 * Phase 1.9.33 — Sponsor Terminal Fixed-Point Plane (public surface).
 */
export {
  SPONSOR_FIXED_POINT_INTERNALS,
  SPONSOR_FIXED_POINT_LAYER_ORDER,
  SPONSOR_FIXED_POINT_LAYER_PHASE,
  SPONSOR_FIXED_POINT_CONSENSUS,
  SponsorFixedPointMutationError,
  SponsorFixedPointDeterminismError,
  type SponsorFixedPointLayerId,
  type SponsorFixedPointConsensusId,
  type SponsorFixedPointConsensusSpec,
} from './sponsorFixedPointInternals';

export {
  generateFixedPointConsensus,
  type SponsorFixedPointConsensus,
  type SponsorFixedPointConsensusRegistry,
} from './sponsorFixedPointConsensus';

export {
  buildTerminalImmutabilityProofs,
  generateLayerDescriptors,
  type SponsorFixedPointLayerDescriptor,
  type SponsorFixedPointLayerInput,
  type SponsorTerminalImmutabilityProof,
  type SponsorTerminalImmutabilityProofs,
} from './sponsorTerminalImmutabilityProofs';

export {
  resolveFixedPointGraph,
  type SponsorFixedPointNode,
  type SponsorFixedPointEdge,
  type SponsorFixedPointNodeKind,
  type SponsorFixedPointEdgeKind,
  type SponsorFixedPointGraph,
} from './sponsorFixedPointGraph';

export {
  computeFixedPointLineage,
  type SponsorFixedPointLineage,
  type SponsorFixedPointLineageEntry,
} from './sponsorFixedPointLineage';

export {
  generateFixedPointSnapshot,
  type SponsorDeterministicFixedPointSnapshot,
} from './sponsorFixedPointSnapshot';

export {
  buildTerminalConsensusEnvelope,
  lockFixedPointEnvelope,
  type SponsorTerminalConsensusEnvelope,
} from './sponsorTerminalConsensusEnvelope';

export {
  buildTerminalFixedPoint,
  assertFixedPointDeterminism,
  type SponsorTerminalFixedPointResult,
} from './sponsorTerminalFixedPointPlane';
