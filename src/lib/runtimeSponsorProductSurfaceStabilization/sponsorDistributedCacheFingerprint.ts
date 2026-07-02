/**
 * Phase 1.9.20 — Sponsor Surface · Distributed cache fingerprint.
 * Deterministic identity for a response, independent of node/region/invocation.
 */
import type { SponsorAPIResponse } from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import { fnv1a, stableStringify } from './sponsorSurfaceInternals';

export interface SponsorDistributedCacheFingerprint {
  readonly cacheKey: string;
  readonly etag: string;
  readonly bodyFingerprint: string;
  readonly headersFingerprint: string;
  readonly compositeFingerprint: string;
}

export function computeEdgeFingerprint(
  response: SponsorAPIResponse,
): SponsorDistributedCacheFingerprint {
  const bodyFingerprint = fnv1a(stableStringify(response.body));
  // Headers fingerprint EXCLUDES consumer identity so cross-consumer parity
  // can be asserted at the structural level.
  const structuralHeaders = {
    apiVersion: response.headers.apiVersion,
    contractVersion: response.headers.contractVersion,
    cacheKey: response.headers.cacheKey,
    etag: response.headers.etag,
    deterministic: response.headers.deterministic,
    readonly: response.headers.readonly,
  };
  const headersFingerprint = fnv1a(stableStringify(structuralHeaders));
  const compositeFingerprint = fnv1a(
    stableStringify({ body: bodyFingerprint, headers: headersFingerprint }),
  );
  return Object.freeze({
    cacheKey: response.headers.cacheKey,
    etag: response.headers.etag,
    bodyFingerprint,
    headersFingerprint,
    compositeFingerprint,
  });
}

/** True iff two fingerprints describe the same structural response. */
export function fingerprintsMatch(
  a: SponsorDistributedCacheFingerprint,
  b: SponsorDistributedCacheFingerprint,
): boolean {
  return (
    a.compositeFingerprint === b.compositeFingerprint &&
    a.etag === b.etag &&
    a.cacheKey === b.cacheKey
  );
}
