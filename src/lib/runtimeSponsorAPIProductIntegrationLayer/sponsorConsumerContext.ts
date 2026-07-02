/**
 * Phase 1.9.19 — Sponsor API · Consumer context.
 * Isolated per-consumer view computed from the public contract snapshot.
 */
import type { SponsorAPIRequest } from './sponsorAPIRequest';

export interface SponsorConsumerContext {
  readonly consumerId: string;
  readonly consumerKind: string;
  readonly cityFilter: string | null;
  readonly categoryFilter: string | null;
  readonly limit: number | null;
  readonly offset: number;
}

export function resolveConsumerContext(req: SponsorAPIRequest): SponsorConsumerContext {
  return Object.freeze({
    consumerId: req.consumerId,
    consumerKind: req.consumerKind ?? 'unknown',
    cityFilter: req.cityFilter ?? null,
    categoryFilter: req.categoryFilter ?? null,
    limit: typeof req.limit === 'number' ? req.limit : null,
    offset: typeof req.offset === 'number' ? req.offset : 0,
  });
}
