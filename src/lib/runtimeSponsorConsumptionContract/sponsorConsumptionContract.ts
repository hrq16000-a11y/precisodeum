/**
 * Phase 1.9.18 — Sponsor Consumption Contract · Model.
 * READ-ONLY / DETERMINISTIC / VERSIONED.
 * Pure aggregation/serialization. NO recalculation. NO mutation upstream.
 */

export type SponsorContractStage = 'STAGE_0_READ_ONLY';
export type SponsorContractVersion = 'v1';

export interface SponsorContractInternals {
  readonly stage: SponsorContractStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly billingEnabled: false;
  readonly chargesEnabled: false;
  readonly schedulingEnabled: false;
  readonly recalculationAllowed: false;
  readonly upstreamMutationAllowed: false;
  readonly internalLeakageAllowed: false;
}

export const SPONSOR_CONTRACT_INTERNALS: SponsorContractInternals = Object.freeze({
  stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  billingEnabled: false,
  chargesEnabled: false,
  schedulingEnabled: false,
  recalculationAllowed: false,
  upstreamMutationAllowed: false,
  internalLeakageAllowed: false,
});

/** External-facing slot decision. Mirrors decision entries with stable field names. */
export interface SponsorContractSlotEntry {
  readonly slotId: string;
  readonly sponsorId: string | null;
  readonly campaignId: string | null;
  readonly score: number;
  readonly priority: number;
  readonly outcome: 'allocated' | 'fairness_floor' | 'saturated' | 'no_candidates';
  /** Projected exposure at the requested tick (null when no campaign mapped). */
  readonly projectedExposure: number | null;
}

/** External-facing campaign summary. No internal weight breakdowns. */
export interface SponsorContractCampaignSummary {
  readonly campaignId: string;
  readonly nodeCount: number;
  readonly categories: ReadonlyArray<string>;
  readonly geographies: ReadonlyArray<string>;
  readonly lifecycle: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  readonly aggregatedWeight: number;
  readonly intensity: number;
}

export interface SponsorContractTemporalSummary {
  readonly tickIndex: number;
  readonly frameCount: number;
  readonly activeFrames: number;
  readonly expiredFrames: number;
}

export interface SponsorContractMeta {
  readonly version: SponsorContractVersion;
  readonly tickIndex: number;
  readonly slotCount: number;
  readonly campaignCount: number;
  readonly allocatedCount: number;
}

export interface SponsorConsumptionPayload {
  readonly contractVersion: SponsorContractVersion;
  readonly meta: SponsorContractMeta;
  readonly slots: ReadonlyArray<SponsorContractSlotEntry>;
  readonly campaigns: ReadonlyArray<SponsorContractCampaignSummary>;
  readonly temporal: SponsorContractTemporalSummary;
}

export interface SponsorContractSnapshot {
  readonly contractVersion: SponsorContractVersion;
  readonly internals: SponsorContractInternals;
  readonly payload: SponsorConsumptionPayload;
  /** FNV-1a signature over the payload (deterministic). */
  readonly signature: string;
  /** Upstream signatures kept for auditing — NEVER consumed externally. */
  readonly upstreamSignatures: Readonly<{
    readonly decision: string;
    readonly campaign: string;
    readonly temporal: string;
  }>;
  readonly locked: true;
}

export class SponsorContractIntegrityError extends Error {
  constructor(message: string) {
    super(`[sponsor-contract] ${message}`);
    this.name = 'SponsorContractIntegrityError';
  }
}
