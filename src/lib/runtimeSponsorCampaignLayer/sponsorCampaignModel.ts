/**
 * Phase 1.9.16 — Sponsor Campaign Abstraction Layer · Model
 * READ-ONLY / DETERMINISTIC / IMMUTABLE.
 * Pure semantic grouping. NO decision logic. NO billing. NO scheduling.
 */
import type { SponsorNode } from '@/lib/runtimeSponsorMonetizationMesh';

export type SponsorCampaignStage = 'STAGE_0_READ_ONLY';

export type SponsorCampaignLifecycle = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

export interface SponsorCampaignInternals {
  readonly stage: SponsorCampaignStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly billingEnabled: false;
  readonly chargesEnabled: false;
  readonly pricingEnabled: false;
  readonly schedulingEnabled: false;
  readonly decisionalImpactAllowed: false;
}

export const SPONSOR_CAMPAIGN_INTERNALS: SponsorCampaignInternals = Object.freeze({
  stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  billingEnabled: false,
  chargesEnabled: false,
  pricingEnabled: false,
  schedulingEnabled: false,
  decisionalImpactAllowed: false,
});

export interface SponsorCampaignAllocationEligibilityWindow {
  /** Logical tick (no Date.now). Inclusive. */
  readonly startTick: number;
  /** Logical tick (no Date.now). Inclusive. */
  readonly endTick: number;
}

export interface SponsorCampaignExposureIntentVector {
  /** Normalized 0..1 — derived from constituent node tiers + qualityIndex. */
  readonly intensity: number;
  /** Normalized 0..1 — share of premium-tier nodes. */
  readonly premiumShare: number;
  /** Normalized 0..1 — share of pro-tier nodes. */
  readonly proShare: number;
  /** Normalized 0..1 — share of basic-tier nodes. */
  readonly basicShare: number;
}

export interface SponsorCampaign {
  readonly campaignId: string;
  readonly sponsorNodeIds: ReadonlyArray<string>;
  readonly categoryScope: ReadonlyArray<string>;
  readonly geoScope: ReadonlyArray<string>;
  readonly exposureIntentVector: SponsorCampaignExposureIntentVector;
  readonly lifecycleState: SponsorCampaignLifecycle;
  readonly allocationEligibilityWindow: SponsorCampaignAllocationEligibilityWindow;
  /** Derived only — NEVER consumed by decision pipeline. */
  readonly derivedCampaignWeight: number;
  readonly snapshotSignature: string;
}

export interface SponsorCampaignGroupingInput {
  readonly nodes: ReadonlyArray<SponsorNode>;
  /** Logical horizon used to bound eligibility window. Defaults to [0, 0]. */
  readonly horizon?: { readonly startTick: number; readonly endTick: number };
}

export interface SponsorCampaignSnapshot {
  readonly version: '1.9.16';
  readonly internals: SponsorCampaignInternals;
  readonly campaigns: ReadonlyArray<SponsorCampaign>;
  readonly nodeToCampaign: Readonly<Record<string, string>>;
  readonly signature: string;
  readonly locked: true;
}

export interface SponsorCampaignIndex {
  readonly byCategory: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly byGeo: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly byNodeDensity: ReadonlyArray<{ readonly campaignId: string; readonly nodeCount: number }>;
  readonly byAggregatedWeight: ReadonlyArray<{ readonly campaignId: string; readonly weight: number }>;
}

export class SponsorCampaignIntegrityError extends Error {
  constructor(message: string) {
    super(`[sponsor-campaign] ${message}`);
    this.name = 'SponsorCampaignIntegrityError';
  }
}
