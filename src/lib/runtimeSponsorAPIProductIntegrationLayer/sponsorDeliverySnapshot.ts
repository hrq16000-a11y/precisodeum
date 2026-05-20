/**
 * Phase 1.9.19 — Sponsor API · Delivery snapshot.
 * Pairs a contract snapshot with a per-consumer response, signed for auditing.
 */
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIRequest } from './sponsorAPIRequest';
import type { SponsorAPIResponse } from './sponsorAPIResponse';
import { deepFreeze, fnv1a, stableStringify } from './sponsorAPIInternals';

export interface SponsorDeliverySnapshot {
  readonly request: SponsorAPIRequest;
  readonly response: SponsorAPIResponse;
  readonly contractSignature: string;
  readonly deliverySignature: string;
  readonly locked: true;
}

export function buildDeliverySnapshot(
  contract: SponsorContractSnapshot,
  request: SponsorAPIRequest,
  response: SponsorAPIResponse,
): SponsorDeliverySnapshot {
  const deliverySignature = fnv1a(
    stableStringify({
      contract: contract.signature,
      etag: response.headers.etag,
      cacheKey: response.headers.cacheKey,
      consumerId: response.headers.consumerId,
    }),
  );
  return deepFreeze({
    request,
    response,
    contractSignature: contract.signature,
    deliverySignature,
    locked: true as const,
  });
}
