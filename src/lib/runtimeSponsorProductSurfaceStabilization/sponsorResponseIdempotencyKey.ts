/**
 * Phase 1.9.20 — Sponsor Surface · Idempotency key.
 * Stable identifier derived from (request shape + contract identity).
 * Independent of node/region/cache-hit/invocation-index.
 */
import type { SponsorAPIRequest } from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import { fnv1a, stableStringify } from './sponsorSurfaceInternals';

export interface SponsorResponseIdempotencyKey {
  readonly raw: string;
  readonly digest: string;
}

export function computeIdempotencyKey(
  request: SponsorAPIRequest,
  contractSignature: string,
): SponsorResponseIdempotencyKey {
  const raw = stableStringify({
    contractSignature,
    apiVersion: request.apiVersion,
    consumerId: request.consumerId,
    consumerKind: request.consumerKind ?? 'unknown',
    cityFilter: request.cityFilter ?? null,
    categoryFilter: request.categoryFilter ?? null,
    limit: request.limit ?? null,
    offset: request.offset ?? 0,
  });
  return Object.freeze({
    raw,
    digest: `idem:v1:${fnv1a(raw)}`,
  });
}
