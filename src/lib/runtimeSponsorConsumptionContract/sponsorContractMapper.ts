/**
 * Phase 1.9.18 — Contract Mapper.
 * Maps upstream snapshots into the external v1 payload shape.
 * NO recalculation. NO mutation. NO leakage of internal weight breakdowns.
 */
import type { SponsorCampaignSnapshot } from '@/lib/runtimeSponsorCampaignLayer';
import type { SponsorDecisionSnapshot } from '@/lib/runtimeSponsorDecisionFinalizer';
import type { TemporalSnapshot } from '@/lib/runtimeSponsorTemporalEvolutionEngine';
import {
  correlateDecisionWithTemporalFrames,
} from '@/lib/runtimeSponsorTemporalEvolutionEngine';
import type {
  SponsorConsumptionPayload,
  SponsorContractCampaignSummary,
  SponsorContractMeta,
  SponsorContractSlotEntry,
  SponsorContractTemporalSummary,
} from './sponsorConsumptionContract';
import {
  freezeArrayOfStrings,
  normalizeNumber,
  sortCampaignSummaries,
  sortSlotEntries,
} from './sponsorContractNormalizer';

function mapSlotEntries(
  decision: SponsorDecisionSnapshot,
  campaign: SponsorCampaignSnapshot,
  temporal: TemporalSnapshot,
): ReadonlyArray<SponsorContractSlotEntry> {
  const exposureMap = correlateDecisionWithTemporalFrames(decision, campaign, temporal);
  const entries: SponsorContractSlotEntry[] = decision.entries.map((e) => {
    const campaignId = e.sponsorId ? campaign.nodeToCampaign[e.sponsorId] ?? null : null;
    const exposureRaw = exposureMap[e.slotId];
    return Object.freeze({
      slotId: e.slotId,
      sponsorId: e.sponsorId,
      campaignId,
      score: normalizeNumber(e.finalScore),
      priority: e.priority,
      outcome: e.reason,
      projectedExposure:
        exposureRaw === null || exposureRaw === undefined
          ? null
          : normalizeNumber(exposureRaw),
    });
  });
  return sortSlotEntries(entries);
}

function mapCampaignSummaries(
  campaign: SponsorCampaignSnapshot,
): ReadonlyArray<SponsorContractCampaignSummary> {
  const out: SponsorContractCampaignSummary[] = campaign.campaigns.map((c) =>
    Object.freeze({
      campaignId: c.campaignId,
      nodeCount: c.sponsorNodeIds.length,
      categories: freezeArrayOfStrings(c.categoryScope),
      geographies: freezeArrayOfStrings(c.geoScope),
      lifecycle: c.lifecycleState,
      aggregatedWeight: normalizeNumber(c.derivedCampaignWeight),
      intensity: normalizeNumber(c.exposureIntentVector.intensity),
    }),
  );
  return sortCampaignSummaries(out);
}

function summarizeTemporal(temporal: TemporalSnapshot): SponsorContractTemporalSummary {
  let active = 0;
  let expired = 0;
  for (const f of temporal.frames) {
    if (f.timeSlice.projectedLifecycle === 'ACTIVE') active++;
    else if (f.timeSlice.projectedLifecycle === 'EXPIRED') expired++;
  }
  return Object.freeze({
    tickIndex: temporal.tick.index,
    frameCount: temporal.frames.length,
    activeFrames: active,
    expiredFrames: expired,
  });
}

export function mapToConsumptionPayload(
  decision: SponsorDecisionSnapshot,
  campaign: SponsorCampaignSnapshot,
  temporal: TemporalSnapshot,
): SponsorConsumptionPayload {
  const slots = mapSlotEntries(decision, campaign, temporal);
  const campaigns = mapCampaignSummaries(campaign);
  const temporalSummary = summarizeTemporal(temporal);

  const allocatedCount = slots.reduce(
    (acc, s) => acc + (s.outcome === 'allocated' ? 1 : 0),
    0,
  );

  const meta: SponsorContractMeta = Object.freeze({
    version: 'v1',
    tickIndex: temporal.tick.index,
    slotCount: slots.length,
    campaignCount: campaigns.length,
    allocatedCount,
  });

  return Object.freeze({
    contractVersion: 'v1' as const,
    meta,
    slots,
    campaigns,
    temporal: temporalSummary,
  });
}
