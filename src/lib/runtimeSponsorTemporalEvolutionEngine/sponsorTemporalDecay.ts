/**
 * Phase 1.9.17 — Exposure Decay.
 * Deterministic geometric decay applied virtually (no mutation upstream).
 */
import type { SponsorCampaign } from '@/lib/runtimeSponsorCampaignLayer';
import type { ExposureDecayVector, TemporalProjectionOptions } from './sponsorTemporalModel';
import { clamp01, intPow } from './sponsorTemporalSnapshot';

const DEFAULT_DECAY_PER_TICK = 0.95;

export function resolveDecayPerTick(
  campaignId: string,
  options: TemporalProjectionOptions = {},
): number {
  const override = options.decayOverrides?.[campaignId];
  const raw = typeof override === 'number' ? override : options.defaultDecayPerTick ?? DEFAULT_DECAY_PER_TICK;
  return clamp01(raw);
}

export function applyExposureDecayVector(
  campaign: SponsorCampaign,
  tickIndex: number,
  options: TemporalProjectionOptions = {},
): ExposureDecayVector {
  const tick = Math.max(0, Math.trunc(tickIndex));
  const decayPerTick = resolveDecayPerTick(campaign.campaignId, options);
  const cumulative = tick === 0 ? 1 : intPow(decayPerTick, tick);
  const cumulativeMultiplier = clamp01(cumulative);
  const decayedIntensity = clamp01(
    campaign.exposureIntentVector.intensity * cumulativeMultiplier,
  );
  return Object.freeze({
    campaignId: campaign.campaignId,
    decayPerTick,
    cumulativeMultiplier,
    decayedIntensity,
  });
}
