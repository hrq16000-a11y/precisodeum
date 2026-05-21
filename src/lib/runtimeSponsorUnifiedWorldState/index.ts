/**
 * Phase 1.9.26 — Sponsor Unified World State Layer (public surface).
 */
export {
  SPONSOR_WORLD_INTERNALS,
  SPONSOR_WORLD_LAYER_ORDER,
  SPONSOR_WORLD_LAYER_PHASE,
  SponsorWorldMutationError,
  SponsorWorldDeterminismError,
  type SponsorWorldLayerId,
} from './sponsorWorldInternals';

export {
  buildUnifiedWorldState,
  type SponsorUnifiedWorldState,
  type SponsorUnifiedWorldStateEntry,
  type SponsorWorldLayerInput,
} from './sponsorUnifiedWorldState';

export {
  resolveCompositionGraph,
  type SponsorWorldStateCompositionGraph,
  type SponsorWorldStateCompositionNode,
  type SponsorWorldStateCompositionEdge,
} from './sponsorWorldCompositionGraph';

export {
  computeWorldLineage,
  type SponsorWorldLineage,
  type SponsorWorldLineageEntry,
} from './sponsorWorldLineage';

export {
  generateWorldSnapshot,
  type SponsorWorldSnapshot,
} from './sponsorWorldSnapshot';

export {
  buildWorldRegistry,
  type SponsorWorldRegistry,
  type SponsorWorldRegistryEntry,
} from './sponsorWorldRegistry';

export {
  buildWorldEnvelope,
  lockWorldEnvelope,
  type SponsorDeterministicWorldEnvelope,
} from './sponsorDeterministicWorldEnvelope';

export {
  runUnifiedWorldStateLayer,
  composeWorldSnapshots,
  assertWorldDeterminism,
  type SponsorUnifiedWorldStateResult,
} from './sponsorUnifiedWorldStateLayer';
