/**
 * Phase 1.9.19 — Sponsor API · Response model.
 * READ-ONLY · DETERMINISTIC · VERSIONED · NO INTERNAL LEAKAGE.
 */
import type {
  SponsorContractCampaignSummary,
  SponsorContractMeta,
  SponsorContractSlotEntry,
  SponsorContractTemporalSummary,
} from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIVersion, SponsorAPIConsumerKind } from './sponsorAPIRequest';

export interface SponsorAPIResponseHeaders {
  readonly apiVersion: SponsorAPIVersion;
  readonly contractVersion: 'v1';
  readonly consumerId: string;
  readonly consumerKind: SponsorAPIConsumerKind;
  readonly cacheKey: string;
  readonly etag: string;
  readonly deterministic: true;
  readonly readonly: true;
}

export interface SponsorAPIResponseBody {
  readonly meta: SponsorContractMeta;
  readonly slots: ReadonlyArray<SponsorContractSlotEntry>;
  readonly campaigns: ReadonlyArray<SponsorContractCampaignSummary>;
  readonly temporal: SponsorContractTemporalSummary;
}

export interface SponsorAPIResponse {
  readonly headers: SponsorAPIResponseHeaders;
  readonly body: SponsorAPIResponseBody;
  readonly locked: true;
}

export class SponsorAPIResponseError extends Error {
  constructor(message: string) {
    super(`[sponsor-api/response] ${message}`);
    this.name = 'SponsorAPIResponseError';
  }
}
