/**
 * Phase 1.9.19 — Sponsor API · Product Integration Layer (entry point).
 *
 * Wraps the deterministic SponsorConsumptionContract (v1) and exposes it as
 * a versioned, read-only, multi-consumer API surface. No engine recalculation.
 */
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIRequest } from './sponsorAPIRequest';
import type { SponsorAPIResponse } from './sponsorAPIResponse';
import { SponsorAPIRouter, type SponsorAPIRoute } from './sponsorAPIRouter';
import { buildDeliverySnapshot, type SponsorDeliverySnapshot } from './sponsorDeliverySnapshot';
import { SPONSOR_API_INTERNALS } from './sponsorAPIInternals';

export class SponsorAPIProductIntegrationLayer {
  private readonly router: SponsorAPIRouter;

  constructor(private readonly contract: SponsorContractSnapshot) {
    if (contract.contractVersion !== 'v1') {
      throw new Error(`[sponsor-api] unsupported contract version: ${contract.contractVersion}`);
    }
    this.router = new SponsorAPIRouter(contract);
  }

  get internals() {
    return SPONSOR_API_INTERNALS;
  }

  buildAPIResponse(request: SponsorAPIRequest): SponsorAPIResponse {
    return this.router.dispatch('GET /v1/sponsor/exposure', request);
  }

  deliver(request: SponsorAPIRequest): SponsorDeliverySnapshot {
    const response = this.buildAPIResponse(request);
    return buildDeliverySnapshot(this.contract, request, response);
  }

  /** Direct route helper for advanced callers. */
  dispatch(route: SponsorAPIRoute, request: SponsorAPIRequest): SponsorAPIResponse {
    return this.router.dispatch(route, request);
  }

  cacheSize(): number {
    return this.router.cacheSize();
  }
}
