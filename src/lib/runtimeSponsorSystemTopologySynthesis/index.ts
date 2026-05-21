/**
 * Phase 1.9.25 — Sponsor System Topology Synthesis Layer (public surface).
 */
export {
  SPONSOR_TOPOLOGY_INTERNALS,
  SPONSOR_TOPOLOGY_LAYER_ORDER,
  SPONSOR_TOPOLOGY_LAYER_PHASE,
  SPONSOR_TOPOLOGY_LAYER_PLANE,
  SponsorTopologyMutationError,
  SponsorTopologyDeterminismError,
  type SponsorTopologyLayerId,
  type SponsorTopologyPlane,
} from './sponsorTopologyInternals';

export {
  buildSystemTopologyGraph,
  type SponsorSystemTopologyGraph,
  type SponsorTopologyNode,
  type SponsorTopologyEdge,
  type SponsorTopologyLayerInput,
} from './sponsorSystemTopologyGraph';

export {
  resolveExecutionDependencies,
  type SponsorExecutionDependencyGraph,
  type SponsorExecutionDependencyNode,
  type SponsorExecutionDependencyEdge,
} from './sponsorExecutionDependencyGraph';

export {
  computeTopologyLineage,
  type SponsorTopologyLineage,
  type SponsorTopologyLineageEntry,
} from './sponsorTopologyLineage';

export {
  generateTopologySnapshot,
  type SponsorTopologySnapshot,
} from './sponsorTopologySnapshot';

export {
  buildTopologyRegistry,
  type SponsorTopologyRegistry,
  type SponsorTopologyRegistryEntry,
} from './sponsorTopologyRegistry';

export {
  buildTopologyEnvelope,
  lockTopologyEnvelope,
  type SponsorDeterministicTopologyEnvelope,
} from './sponsorDeterministicTopologyEnvelope';

export {
  runSystemTopologySynthesisLayer,
  assertTopologyDeterminism,
  type SponsorSystemTopologySynthesisResult,
} from './sponsorSystemTopologySynthesisLayer';
