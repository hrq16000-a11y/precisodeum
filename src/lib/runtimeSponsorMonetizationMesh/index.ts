/**
 * Phase 1.9.14 — Runtime Sponsor Monetization Mesh public entrypoint.
 * READ-ONLY / DETERMINISTIC / REVERSIBLE.
 * NO billing, NO payment, NO charges, NO live execution.
 */
export * from './sponsorMeshTypes';
export {
  SPONSOR_MESH_INTERNALS,
  deepFreeze as sponsorDeepFreeze,
  signObject as sponsorSignObject,
} from './sponsorMeshInternals';
export { rankCandidates, type RankedCandidate } from './sponsorRankingModel';
export { computeFairnessLedger } from './sponsorFairnessEngine';
export {
  computeSaturationMap,
  isSponsorSaturated,
} from './sponsorSaturationController';
export { allocateSlot, allocateAll } from './sponsorAllocationEngine';
export { projectExposures, mergeExposures } from './sponsorExposurePipeline';
export { buildAttributionTraces } from './sponsorAttributionTracker';
export { computeGeoMesh, type CityDemandSignal } from './sponsorGeoMesh';
export {
  buildSponsorEdges,
  buildSponsorMeshSnapshot,
  SPONSOR_GRAPH_SKELETON,
} from './sponsorGraph';
export {
  SponsorMeshIntegrityError,
  assertReadOnlyInternals,
  assertNodesValid,
  assertPolicyValid,
  assertExposuresValid,
  assertSnapshotIntegrity,
} from './sponsorMeshGuards';
export {
  observeExposures,
  observeAllocations,
  scrub as sponsorScrub,
  type SponsorObservabilityEvent,
} from './sponsorObservability';
