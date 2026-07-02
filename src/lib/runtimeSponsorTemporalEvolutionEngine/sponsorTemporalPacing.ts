/**
 * Phase 1.9.17 — Pacing windows.
 * Deterministic triangular pacing across a fixed window.
 */
import type { SponsorCampaign } from '@/lib/runtimeSponsorCampaignLayer';
import type { PacingWindow, TemporalProjectionOptions } from './sponsorTemporalModel';
import { clamp01 } from './sponsorTemporalSnapshot';

const DEFAULT_WINDOW = 7;

export function resolvePacingWindowSize(
  campaignId: string,
  options: TemporalProjectionOptions = {},
): number {
  const override = options.pacingOverrides?.[campaignId];
  const raw = typeof override === 'number' ? override : options.defaultPacingWindow ?? DEFAULT_WINDOW;
  const n = Math.max(1, Math.trunc(raw));
  return n;
}

/**
 * Deterministic triangular pacing:
 * - At tick=0: pacingFactor = 1.0 (full budget — preserves bit-identity).
 * - For tick>0: triangular shape peaking mid-window (0..1).
 * Allocated share = pacingFactor / windowSize.
 */
export function computePacingWindow(
  campaign: SponsorCampaign,
  tickIndex: number,
  options: TemporalProjectionOptions = {},
): PacingWindow {
  const tick = Math.max(0, Math.trunc(tickIndex));
  const windowSize = resolvePacingWindowSize(campaign.campaignId, options);
  const windowPosition = tick % windowSize;

  let pacingFactor: number;
  if (tick === 0) {
    pacingFactor = 1;
  } else if (windowSize === 1) {
    pacingFactor = 1;
  } else {
    const mid = (windowSize - 1) / 2;
    const dist = Math.abs(windowPosition - mid);
    pacingFactor = clamp01(1 - dist / (mid === 0 ? 1 : mid));
  }

  const allocatedShare = clamp01(pacingFactor / windowSize);

  return Object.freeze({
    campaignId: campaign.campaignId,
    tickIndex: tick,
    windowSize,
    windowPosition,
    pacingFactor,
    allocatedShare,
  });
}
