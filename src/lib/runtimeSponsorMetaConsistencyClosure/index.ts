/**
 * Phase 1.9.32 — Sponsor Meta-Consistency Closure Plane (public surface).
 */
export {
  SPONSOR_CLOSURE_INTERNALS,
  SPONSOR_CLOSURE_LAYER_ORDER,
  SPONSOR_CLOSURE_LAYER_PHASE,
  SPONSOR_CONSISTENCY_THEOREMS,
  SponsorClosureMutationError,
  SponsorClosureDeterminismError,
  type SponsorClosureLayerId,
  type SponsorConsistencyTheoremId,
  type SponsorConsistencyTheoremSpec,
} from './sponsorClosureInternals';

export {
  generateConsistencyTheorems,
  type SponsorConsistencyTheorem,
  type SponsorConsistencyTheoremRegistry,
} from './sponsorConsistencyTheorems';

export {
  buildTerminalConsistencyProofs,
  generateLayerDescriptors,
  type SponsorClosureLayerDescriptor,
  type SponsorClosureLayerInput,
  type SponsorTerminalConsistencyProof,
  type SponsorTerminalConsistencyProofs,
} from './sponsorTerminalConsistencyProofs';

export {
  resolveClosureTheoremGraph,
  type SponsorClosureNode,
  type SponsorClosureEdge,
  type SponsorClosureNodeKind,
  type SponsorClosureEdgeKind,
  type SponsorClosureTheoremGraph,
} from './sponsorClosureTheoremGraph';

export {
  computeClosureLineage,
  type SponsorClosureLineage,
  type SponsorClosureLineageEntry,
} from './sponsorClosureLineage';

export {
  generateClosureSnapshot,
  type SponsorDeterministicClosureSnapshot,
} from './sponsorClosureSnapshot';

export {
  buildAbsoluteClosureEnvelope,
  lockClosureEnvelope,
  type SponsorAbsoluteClosureEnvelope,
} from './sponsorAbsoluteClosureEnvelope';

export {
  buildMetaConsistencyClosure,
  assertClosureDeterminism,
  type SponsorMetaConsistencyClosureResult,
} from './sponsorMetaConsistencyClosurePlane';
