/**
 * Phase 1.9.29 — Sponsor System Manifest Plane (public surface).
 */
export {
  SPONSOR_MANIFEST_INTERNALS,
  SPONSOR_MANIFEST_LAYERS,
  SPONSOR_MANIFEST_LAYER_ORDER,
  SponsorManifestMutationError,
  SponsorManifestDeterminismError,
  type SponsorManifestLayerId,
  type SponsorManifestLayerSpec,
  type SponsorManifestPlane,
} from './sponsorManifestInternals';

export {
  buildManifestRegistry,
  type SponsorManifestRegistry,
} from './sponsorManifestRegistry';

export {
  generateManifestDescriptors,
  type SponsorManifestDescriptor,
  type SponsorManifestLayerInput,
} from './sponsorManifestDescriptors';

export {
  resolveIntrospectionGraph,
  type SponsorIntrospectionGraph,
  type SponsorIntrospectionNode,
  type SponsorIntrospectionEdge,
} from './sponsorIntrospectionGraph';

export {
  computeManifestLineage,
  type SponsorManifestLineage,
  type SponsorManifestLineageEntry,
} from './sponsorManifestLineage';

export {
  generateManifestSnapshot,
  type SponsorDeterministicManifestSnapshot,
} from './sponsorManifestSnapshot';

export {
  buildSystemManifest,
  buildManifestEnvelope,
  lockManifestEnvelope,
  type SponsorSystemManifest,
  type SponsorManifestEnvelope,
} from './sponsorManifestEnvelope';

export {
  runSystemManifestPlane,
  assertManifestDeterminism,
  type SponsorSystemManifestResult,
} from './sponsorSystemManifestPlane';
