/**
 * Phase 1.9.16 — Campaign Index.
 * Derived projection only. NEVER consumed by decision pipeline.
 */
import type { SponsorCampaign, SponsorCampaignIndex } from './sponsorCampaignModel';
import { deepFreeze } from './sponsorCampaignSnapshot';

export function buildCampaignIndex(
  campaigns: ReadonlyArray<SponsorCampaign>,
): SponsorCampaignIndex {
  const byCategory: Record<string, string[]> = {};
  const byGeo: Record<string, string[]> = {};

  for (const c of campaigns) {
    for (const cat of c.categoryScope) {
      (byCategory[cat] ??= []).push(c.campaignId);
    }
    for (const geo of c.geoScope) {
      (byGeo[geo] ??= []).push(c.campaignId);
    }
  }

  for (const k of Object.keys(byCategory)) byCategory[k] = byCategory[k].sort();
  for (const k of Object.keys(byGeo)) byGeo[k] = byGeo[k].sort();

  const byNodeDensity = [...campaigns]
    .map((c) => ({ campaignId: c.campaignId, nodeCount: c.sponsorNodeIds.length }))
    .sort(
      (a, b) =>
        b.nodeCount - a.nodeCount || a.campaignId.localeCompare(b.campaignId),
    );

  const byAggregatedWeight = [...campaigns]
    .map((c) => ({ campaignId: c.campaignId, weight: c.derivedCampaignWeight }))
    .sort(
      (a, b) =>
        b.weight - a.weight || a.campaignId.localeCompare(b.campaignId),
    );

  return deepFreeze({
    byCategory,
    byGeo,
    byNodeDensity,
    byAggregatedWeight,
  });
}
