/**
 * Phase 1.9.18 — Contract Normalizer.
 * Stable ordering + numeric normalization without recalculation.
 */
import type {
  SponsorContractCampaignSummary,
  SponsorContractSlotEntry,
} from './sponsorConsumptionContract';

export function normalizeNumber(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  // Stable 6-decimal rounding for byte-identical signatures across platforms.
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function sortSlotEntries(
  entries: ReadonlyArray<SponsorContractSlotEntry>,
): ReadonlyArray<SponsorContractSlotEntry> {
  return Object.freeze(
    [...entries].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.slotId.localeCompare(b.slotId);
    }),
  );
}

export function sortCampaignSummaries(
  campaigns: ReadonlyArray<SponsorContractCampaignSummary>,
): ReadonlyArray<SponsorContractCampaignSummary> {
  return Object.freeze(
    [...campaigns].sort((a, b) => a.campaignId.localeCompare(b.campaignId)),
  );
}

export function freezeArrayOfStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...values].sort());
}
