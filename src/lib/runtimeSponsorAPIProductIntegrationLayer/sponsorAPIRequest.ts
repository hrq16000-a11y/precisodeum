/**
 * Phase 1.9.19 — Sponsor API · Request model.
 * READ-ONLY · DETERMINISTIC · VERSIONED.
 */

export type SponsorAPIVersion = 'v1';

export type SponsorAPIConsumerKind =
  | 'frontend'
  | 'analytics'
  | 'cdn'
  | 'internal'
  | 'unknown';

export interface SponsorAPIRequest {
  readonly apiVersion: SponsorAPIVersion;
  readonly consumerId: string;
  readonly consumerKind: SponsorAPIConsumerKind;
  /** Optional filter — when present, only slots whose city matches are exposed. */
  readonly cityFilter?: string;
  /** Optional filter — when present, only slots whose category matches are exposed. */
  readonly categoryFilter?: string;
  /** Optional pagination — applied AFTER deterministic ordering. */
  readonly limit?: number;
  readonly offset?: number;
}

export class SponsorAPIRequestError extends Error {
  constructor(message: string) {
    super(`[sponsor-api/request] ${message}`);
    this.name = 'SponsorAPIRequestError';
  }
}

export function normalizeAPIRequest(req: SponsorAPIRequest): SponsorAPIRequest {
  if (req.apiVersion !== 'v1') {
    throw new SponsorAPIRequestError(`unsupported apiVersion: ${req.apiVersion}`);
  }
  if (!req.consumerId || typeof req.consumerId !== 'string') {
    throw new SponsorAPIRequestError('consumerId is required');
  }
  const limit =
    typeof req.limit === 'number' && req.limit >= 0 && Number.isFinite(req.limit)
      ? Math.floor(req.limit)
      : undefined;
  const offset =
    typeof req.offset === 'number' && req.offset >= 0 && Number.isFinite(req.offset)
      ? Math.floor(req.offset)
      : undefined;
  return Object.freeze({
    apiVersion: 'v1' as const,
    consumerId: req.consumerId,
    consumerKind: req.consumerKind ?? 'unknown',
    cityFilter: req.cityFilter,
    categoryFilter: req.categoryFilter,
    limit,
    offset,
  });
}
