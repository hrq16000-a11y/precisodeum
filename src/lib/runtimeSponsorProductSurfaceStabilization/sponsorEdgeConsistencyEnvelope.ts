/**
 * Phase 1.9.20 — Sponsor Surface · Consistency envelope.
 * Wraps an API response with edge-readiness metadata. Does NOT mutate the payload.
 */
import type { SponsorAPIResponse } from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import type { SponsorDistributedCacheFingerprint } from './sponsorDistributedCacheFingerprint';
import type { SponsorResponseIdempotencyKey } from './sponsorResponseIdempotencyKey';
import type { SponsorSurfaceExecutionContext } from './sponsorSurfaceExecutionContext';

export interface SponsorEdgeConsistencyEnvelope {
  readonly response: SponsorAPIResponse;
  readonly fingerprint: SponsorDistributedCacheFingerprint;
  readonly idempotencyKey: SponsorResponseIdempotencyKey;
  /** Stable across all nodes for the same (contract, request) tuple. */
  readonly stabilityToken: string;
  /** Informational only — never embedded in fingerprint or payload. */
  readonly executionContext: SponsorSurfaceExecutionContext;
  readonly locked: true;
}
