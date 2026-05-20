/**
 * Phase 1.9.19 — Sponsor API · Deterministic in-memory cache.
 * No timers, no TTL — purely a memoization keyed by (contract signature, request shape).
 */
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIRequest } from './sponsorAPIRequest';
import type { SponsorAPIResponse } from './sponsorAPIResponse';
import { fnv1a, stableStringify } from './sponsorAPIInternals';

export function generateCacheKey(
  snapshot: SponsorContractSnapshot,
  req: SponsorAPIRequest,
): string {
  const seed = stableStringify({
    sig: snapshot.signature,
    contract: snapshot.contractVersion,
    api: req.apiVersion,
    city: req.cityFilter ?? null,
    category: req.categoryFilter ?? null,
    limit: req.limit ?? null,
    offset: req.offset ?? 0,
  });
  return `sponsor-api:v1:${fnv1a(seed)}`;
}

export class SponsorResponseCache {
  private readonly store = new Map<string, SponsorAPIResponse>();

  get(key: string): SponsorAPIResponse | undefined {
    return this.store.get(key);
  }

  set(key: string, response: SponsorAPIResponse): SponsorAPIResponse {
    if (!this.store.has(key)) this.store.set(key, response);
    return this.store.get(key)!;
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
