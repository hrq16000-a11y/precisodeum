/**
 * Phase 1.9.31 — Sponsor System Constitution Plane (public surface).
 */
export {
  SPONSOR_CONSTITUTION_INTERNALS,
  SPONSOR_CONSTITUTION_LAYERS,
  SPONSOR_CONSTITUTION_LAYER_ORDER,
  SPONSOR_CONSTITUTIONAL_AXIOMS,
  SPONSOR_SUPREME_INVARIANTS,
  SponsorConstitutionMutationError,
  SponsorConstitutionDeterminismError,
  type SponsorConstitutionLayerId,
  type SponsorConstitutionLayerSpec,
  type SponsorConstitutionalAxiomId,
  type SponsorConstitutionalAxiomSpec,
  type SponsorSupremeInvariantId,
  type SponsorSupremeInvariantSpec,
} from './sponsorConstitutionInternals';

export {
  generateConstitutionalAxioms,
  type SponsorConstitutionalAxiom,
  type SponsorConstitutionalAxiomsRegistry,
} from './sponsorConstitutionalAxioms';

export {
  buildSupremeInvariantRegistry,
  type SponsorSupremeInvariant,
  type SponsorSupremeInvariantRegistry,
} from './sponsorSupremeInvariantRegistry';

export {
  generateLayerDescriptors,
  resolveConstitutionGraph,
  type SponsorConstitutionGraph,
  type SponsorConstitutionNode,
  type SponsorConstitutionEdge,
  type SponsorConstitutionLayerInput,
  type SponsorConstitutionLayerDescriptor,
} from './sponsorConstitutionGraph';

export {
  computeConstitutionLineage,
  type SponsorConstitutionLineage,
  type SponsorConstitutionLineageEntry,
} from './sponsorConstitutionLineage';

export {
  generateConstitutionSnapshot,
  type SponsorDeterministicConstitutionSnapshot,
} from './sponsorConstitutionSnapshot';

export {
  buildSystemConstitution,
  buildConstitutionCertificationEnvelope,
  lockConstitutionEnvelope,
  type SponsorSystemConstitution,
  type SponsorConstitutionCertificationEnvelope,
} from './sponsorConstitutionCertificationEnvelope';

export {
  runSystemConstitutionPlane,
  assertConstitutionDeterminism,
  type SponsorSystemConstitutionResult,
} from './sponsorSystemConstitutionPlane';
