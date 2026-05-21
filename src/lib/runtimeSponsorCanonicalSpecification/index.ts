/**
 * Phase 1.9.30 — Sponsor Canonical Specification Plane (public surface).
 */
export {
  SPONSOR_SPECIFICATION_INTERNALS,
  SPONSOR_SPECIFICATION_LAYERS,
  SPONSOR_SPECIFICATION_LAYER_ORDER,
  SponsorSpecificationMutationError,
  SponsorSpecificationDeterminismError,
  type SponsorSpecificationLayerId,
  type SponsorSpecificationLayerSpec,
  type SponsorSpecificationPlane,
  type SponsorExecutionSemanticKind,
} from './sponsorSpecificationInternals';

export {
  buildSpecificationRegistry,
  type SponsorSpecificationRegistry,
} from './sponsorSpecificationRegistry';

export {
  generateExecutionSemantics,
  type SponsorExecutionSemanticDescriptor,
  type SponsorExecutionSemanticsRegistry,
  type SponsorSpecificationLayerInput,
} from './sponsorExecutionSemantics';

export {
  resolveConstraintSpecificationGraph,
  type SponsorConstraintSpecificationGraph,
  type SponsorConstraintNode,
  type SponsorConstraintEdge,
} from './sponsorConstraintSpecificationGraph';

export {
  computeSpecificationLineage,
  type SponsorSpecificationLineage,
  type SponsorSpecificationLineageEntry,
} from './sponsorSpecificationLineage';

export {
  generateSpecificationSnapshot,
  type SponsorDeterministicSpecificationSnapshot,
} from './sponsorSpecificationSnapshot';

export {
  buildCanonicalSpecification,
  buildArchitectureCertificationEnvelope,
  lockSpecificationEnvelope,
  type SponsorCanonicalSpecification,
  type SponsorArchitectureCertificationEnvelope,
} from './sponsorArchitectureCertificationEnvelope';

export {
  runCanonicalSpecificationPlane,
  assertSpecificationDeterminism,
  type SponsorCanonicalSpecificationResult,
} from './sponsorCanonicalSpecificationPlane';
