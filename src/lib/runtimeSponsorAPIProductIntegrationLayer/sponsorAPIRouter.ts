/**
 * Phase 1.9.19 — Sponsor API · Router.
 * Pure dispatch over a fixed contract snapshot. No networking, no I/O.
 */
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIRequest } from './sponsorAPIRequest';
import { normalizeAPIRequest, SponsorAPIRequestError } from './sponsorAPIRequest';
import type { SponsorAPIResponse } from './sponsorAPIResponse';
import { resolveConsumerContext } from './sponsorConsumerContext';
import {
  buildResponseHeaders,
  lockAPIResponse,
  normalizeContractToResponseBody,
} from './sponsorResponseBuilder';
import { SponsorResponseCache, generateCacheKey } from './sponsorResponseCache';

export type SponsorAPIRoute = 'GET /v1/sponsor/exposure';

export class SponsorAPIRouter {
  private readonly cache = new SponsorResponseCache();

  constructor(private readonly snapshot: SponsorContractSnapshot) {}

  /** Single supported route in v1. */
  dispatch(route: SponsorAPIRoute, raw: SponsorAPIRequest): SponsorAPIResponse {
    if (route !== 'GET /v1/sponsor/exposure') {
      throw new SponsorAPIRequestError(`unknown route: ${route}`);
    }
    const req = normalizeAPIRequest(raw);
    const cacheKey = generateCacheKey(this.snapshot, req);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const ctx = resolveConsumerContext(req);
    const body = normalizeContractToResponseBody(this.snapshot, ctx);
    const headers = buildResponseHeaders(this.snapshot, ctx, body, cacheKey);
    const response = lockAPIResponse(headers, body);
    return this.cache.set(cacheKey, response);
  }

  cacheSize(): number {
    return this.cache.size();
  }
}
