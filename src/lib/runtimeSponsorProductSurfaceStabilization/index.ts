/**
 * Phase 1.9.20 — Sponsor Product Surface Stabilization Layer.
 * Stateless edge-readiness enforcement over the v1 API surface (1.9.19).
 */
export * from './sponsorSurfaceExecutionContext';
export * from './sponsorDistributedCacheFingerprint';
export * from './sponsorResponseIdempotencyKey';
export * from './sponsorEdgeConsistencyEnvelope';
export * from './sponsorResponseStabilityValidator';
export * from './sponsorSurfaceConsistencyGuard';
export * from './sponsorProductSurfaceStabilizationLayer';
export {
  SPONSOR_SURFACE_INTERNALS,
  SponsorSurfaceStabilityError,
} from './sponsorSurfaceInternals';
