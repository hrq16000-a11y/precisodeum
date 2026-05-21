/**
 * Phase 1.9.37 — Sponsor Absolute Unity Plane (public surface).
 */
export {
  SPONSOR_UNITY_INTERNALS,
  SPONSOR_UNITY_LAYER_ORDER,
  SPONSOR_UNITY_LAYER_PHASE,
  SPONSOR_UNITY_INVARIANTS,
  SponsorUnityMutationError,
  SponsorUnityDeterminismError,
  type SponsorUnityLayerId,
  type SponsorUnityInvariantId,
  type SponsorUnityInvariantSpec,
} from './sponsorUnityInternals';

export {
  generateUnityInvariants,
  type SponsorUnityInvariant,
  type SponsorUnityInvariantRegistry,
} from './sponsorUnityInvariants';

export {
  buildSelfEquivalenceProofs,
  generateUnityLayerDescriptors,
  type SponsorUnityLayerDescriptor,
  type SponsorUnityLayerInput,
  type SponsorSelfEquivalenceProof,
  type SponsorSelfEquivalenceProofs,
} from './sponsorSelfEquivalenceProofs';

export {
  resolveUnityGraph,
  type SponsorUnityGraph,
  type SponsorUnityNode,
  type SponsorUnityEdge,
  type SponsorUnityNodeKind,
  type SponsorUnityEdgeKind,
} from './sponsorUnityGraph';

export {
  computeUnityLineage,
  type SponsorUnityLineage,
  type SponsorUnityLineageEntry,
} from './sponsorUnityLineage';

export {
  generateUnitySnapshot,
  type SponsorDeterministicUnitySnapshot,
} from './sponsorUnitySnapshot';

export {
  buildAbsoluteUnityEnvelope,
  lockUnityEnvelope,
  type SponsorAbsoluteUnityEnvelope,
} from './sponsorAbsoluteUnityEnvelope';

export {
  buildAbsoluteUnity,
  assertUnityDeterminism,
  type SponsorAbsoluteUnityResult,
} from './sponsorAbsoluteUnityPlane';
