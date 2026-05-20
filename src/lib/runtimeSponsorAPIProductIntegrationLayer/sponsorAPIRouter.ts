/**
 * Phase 1.9.19 — Sponsor API · Router.
 * Pure dispatch over a fixed contract snapshot. No networking, no I/O.
 *
 * Cache strategy:
 * - Body cache is keyed by (contract signature + filters/pagination) — consumer-agnostic.
 * - Headers are rebuilt per request so consumer identity is reflected.
 * - Final response is memoized per (cacheKey, consumerId, consumerKind) tuple so
 *   repeated calls from the same consumer return the exact same locked instance.
 */
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIRequest } from './sponsorAPIRequest';
import { normalizeAPIRequest, SponsorAPIRequestError } from './sponsorAPIRequest';
import type { SponsorAPIResponse, SponsorAPIResponseBody } from './sponsorAPIResponse';
import { resolveConsumerContext } from './sponsorConsumerContext';
import {
  buildResponseHeaders,
  lockAPIResponse,
  normalizeContractToResponseBody,
} from './sponsorResponseBuilder';
import { SponsorResponseCache, generateCacheKey } from './sponsorResponseCache';

export type SponsorAPIRoute = 'GET /v1/sponsor/exposure';

export class SponsorAPIRouter {
  private readonly responseCache = new SponsorResponseCache();
  private readonly bodyCache = new Map<string, SponsorAPIResponseBody>();

  constructor(private readonly snapshot: SponsorContractSnapshot) {}

  dispatch(route: SponsorAPIRoute, raw: SponsorAPIRequest): SponsorAPIResponse {
    if (route !== 'GET /v1/sponsor/exposure') {
      throw new SponsorAPIRequestError(`unknown route: ${route}`);
    }
    const req = normalizeAPIRequest(raw);
    const cacheKey = generateCacheKey(this.snapshot, req);
    const consumerCacheKey = `${cacheKey}::${req.consumerId}::${req.consumerKind}`;

    const cached = this.responseCache.get(consumerCacheKey);
    if (cached) return cached;

    const ctx = resolveConsumerContext(req);
    let body = this.bodyCache.get(cacheKey);
    if (!body) {
      body = normalizeContractToResponseBody(this.snapshot, ctx);
      this.bodyCache.set(cacheKey, body);
    }
    const headers = buildResponseHeaders(this.snapshot, ctx, body, cacheKey);
    const response = lockAPIResponse(headers, body);
    return this.responseCache.set(consumerCacheKey, response);
  }

  cacheSize(): number {
    return this.responseCache.size();
  }
}
