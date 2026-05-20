/**
 * Phase 1.9.18 — Contract Validator.
 * Schema-shape validation only. Read-only. No recalculation.
 */
import type {
  SponsorConsumptionPayload,
  SponsorContractSlotEntry,
} from './sponsorConsumptionContract';
import { SponsorContractIntegrityError } from './sponsorConsumptionContract';

const VALID_OUTCOMES: ReadonlySet<SponsorContractSlotEntry['outcome']> = new Set([
  'allocated',
  'fairness_floor',
  'saturated',
  'no_candidates',
]);

const VALID_LIFECYCLES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED']);

function inRange01(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

export function validateConsumptionPayload(payload: SponsorConsumptionPayload): void {
  if (payload.contractVersion !== 'v1') {
    throw new SponsorContractIntegrityError(`unsupported contract version: ${payload.contractVersion}`);
  }
  if (payload.meta.version !== 'v1') {
    throw new SponsorContractIntegrityError('meta.version mismatch');
  }
  if (payload.meta.slotCount !== payload.slots.length) {
    throw new SponsorContractIntegrityError('meta.slotCount mismatch');
  }
  if (payload.meta.campaignCount !== payload.campaigns.length) {
    throw new SponsorContractIntegrityError('meta.campaignCount mismatch');
  }
  if (payload.meta.tickIndex !== payload.temporal.tickIndex) {
    throw new SponsorContractIntegrityError('meta.tickIndex mismatch with temporal');
  }

  for (const s of payload.slots) {
    if (!s.slotId) throw new SponsorContractIntegrityError('slot missing slotId');
    if (!VALID_OUTCOMES.has(s.outcome)) {
      throw new SponsorContractIntegrityError(`invalid outcome: ${s.outcome}`);
    }
    if (!inRange01(s.score)) {
      throw new SponsorContractIntegrityError(`slot.score out of [0,1]: ${s.score}`);
    }
    if (!Number.isInteger(s.priority) || s.priority < 0) {
      throw new SponsorContractIntegrityError(`slot.priority invalid: ${s.priority}`);
    }
    if (s.projectedExposure !== null && !inRange01(s.projectedExposure)) {
      throw new SponsorContractIntegrityError(
        `slot.projectedExposure out of [0,1]: ${s.projectedExposure}`,
      );
    }
  }

  for (const c of payload.campaigns) {
    if (!c.campaignId) throw new SponsorContractIntegrityError('campaign missing campaignId');
    if (!VALID_LIFECYCLES.has(c.lifecycle)) {
      throw new SponsorContractIntegrityError(`invalid lifecycle: ${c.lifecycle}`);
    }
    if (!inRange01(c.aggregatedWeight)) {
      throw new SponsorContractIntegrityError(
        `campaign.aggregatedWeight out of [0,1]: ${c.aggregatedWeight}`,
      );
    }
    if (!inRange01(c.intensity)) {
      throw new SponsorContractIntegrityError(`campaign.intensity out of [0,1]: ${c.intensity}`);
    }
    if (!Number.isInteger(c.nodeCount) || c.nodeCount < 0) {
      throw new SponsorContractIntegrityError(`campaign.nodeCount invalid: ${c.nodeCount}`);
    }
  }

  // Stable ordering guarantees
  for (let i = 1; i < payload.campaigns.length; i++) {
    if (payload.campaigns[i - 1].campaignId.localeCompare(payload.campaigns[i].campaignId) > 0) {
      throw new SponsorContractIntegrityError('campaigns not stably ordered');
    }
  }
  for (let i = 1; i < payload.slots.length; i++) {
    const a = payload.slots[i - 1];
    const b = payload.slots[i];
    if (a.priority > b.priority) {
      throw new SponsorContractIntegrityError('slots not stably ordered by priority');
    }
  }
}

/** Surface keys that MUST appear and MUST NOT appear in the external payload. */
const FORBIDDEN_INTERNAL_KEYS = new Set([
  'sponsorNodeIds',
  'exposureIntentVector',
  'snapshotSignature',
  'allocationEligibilityWindow',
  'derivedCampaignWeight',
  'inputs',
  'reason',
  'finalScore',
  'rankingScore',
  'fairnessWeight',
  'saturationPenalty',
  'geoBalanceFactor',
  'exposureDecayFactor',
  'cumulativeMultiplier',
  'decayPerTick',
  'pacingFactor',
  'frameSignature',
  'frames',
  'timeSlice',
]);

export function assertNoInternalLeakage(payload: SponsorConsumptionPayload): void {
  const visit = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    for (const key of Object.keys(v as Record<string, unknown>)) {
      if (FORBIDDEN_INTERNAL_KEYS.has(key)) {
        throw new SponsorContractIntegrityError(`internal key leaked: ${key}`);
      }
      visit((v as Record<string, unknown>)[key]);
    }
  };
  visit(payload);
}
