/**
 * Phase 1.9.17 — Sponsor Temporal Evolution Engine.
 * Builds deterministic temporal projections from a (read-only) SponsorCampaignSnapshot.
 * NEVER mutates campaigns, decisions, or mesh.
 */
import type {
  SponsorCampaign,
  SponsorCampaignSnapshot,
} from '@/lib/runtimeSponsorCampaignLayer';
import type { SponsorDecisionSnapshot } from '@/lib/runtimeSponsorDecisionFinalizer';
import type {
  CampaignTimeSlice,
  EvolutionFrame,
  TemporalProjectionOptions,
  TemporalSnapshot,
  TemporalTick,
} from './sponsorTemporalModel';
import {
  SPONSOR_TEMPORAL_INTERNALS,
  SponsorTemporalIntegrityError,
} from './sponsorTemporalModel';
import {
  assertTemporalSnapshotLocked,
  clamp01,
  deepFreeze,
  signTemporalPayload,
} from './sponsorTemporalSnapshot';
import { applyExposureDecayVector } from './sponsorTemporalDecay';
import { computePacingWindow } from './sponsorTemporalPacing';

function projectLifecycle(
  campaign: SponsorCampaign,
  decayedIntensity: number,
  tick: number,
): CampaignTimeSlice['projectedLifecycle'] {
  if (tick === 0) return campaign.lifecycleState;
  if (campaign.lifecycleState === 'PAUSED' || campaign.lifecycleState === 'DRAFT') {
    return campaign.lifecycleState;
  }
  // ACTIVE virtual evolution: expires when decayed intensity collapses below epsilon.
  if (decayedIntensity <= 0.01) return 'EXPIRED';
  return 'ACTIVE';
}

function buildTimeSlice(
  campaign: SponsorCampaign,
  tickIndex: number,
  decayedIntensity: number,
  cumulativeMultiplier: number,
): CampaignTimeSlice {
  const projectedWeight = clamp01(campaign.derivedCampaignWeight * cumulativeMultiplier);
  return Object.freeze({
    campaignId: campaign.campaignId,
    tickIndex,
    projectedIntensity: decayedIntensity,
    projectedWeight,
    projectedLifecycle: projectLifecycle(campaign, decayedIntensity, tickIndex),
  });
}

function buildFrame(
  campaign: SponsorCampaign,
  tickIndex: number,
  options: TemporalProjectionOptions,
): EvolutionFrame {
  const decay = applyExposureDecayVector(campaign, tickIndex, options);
  const pacing = computePacingWindow(campaign, tickIndex, options);
  const slice = buildTimeSlice(
    campaign,
    tickIndex,
    decay.decayedIntensity,
    decay.cumulativeMultiplier,
  );
  const projectedExposure = clamp01(
    slice.projectedIntensity * pacing.pacingFactor,
  );
  const frameSignature = signTemporalPayload({
    campaignId: campaign.campaignId,
    tickIndex,
    slice,
    decay,
    pacing,
    projectedExposure,
  });
  return Object.freeze({
    campaignId: campaign.campaignId,
    tickIndex,
    timeSlice: slice,
    decay,
    pacing,
    projectedExposure,
    frameSignature,
  });
}

export function buildTemporalSnapshot(
  campaignSnapshot: SponsorCampaignSnapshot,
  tickIndex: number,
  options: TemporalProjectionOptions = {},
  decisionSnapshot: SponsorDecisionSnapshot | null = null,
): TemporalSnapshot {
  if (!campaignSnapshot.locked) {
    throw new SponsorTemporalIntegrityError('input campaign snapshot must be locked');
  }
  const tick: TemporalTick = Object.freeze({
    index: Math.max(0, Math.trunc(tickIndex)),
  });

  const frames = campaignSnapshot.campaigns
    .map((c) => buildFrame(c, tick.index, options))
    .sort((a, b) => a.campaignId.localeCompare(b.campaignId));

  const signature = signTemporalPayload({
    version: '1.9.17',
    tick: tick.index,
    frames,
    campaignSignature: campaignSnapshot.signature,
    decisionSignature: decisionSnapshot?.signature ?? null,
    internals: SPONSOR_TEMPORAL_INTERNALS,
  });

  const snapshot: TemporalSnapshot = deepFreeze({
    version: '1.9.17' as const,
    internals: SPONSOR_TEMPORAL_INTERNALS,
    tick,
    frames,
    campaignSignature: campaignSnapshot.signature,
    decisionSignature: decisionSnapshot?.signature ?? null,
    signature,
    locked: true as const,
  });

  assertTemporalSnapshotLocked(snapshot);
  return snapshot;
}

/** Re-export pure helper for external use. */
export { applyExposureDecayVector } from './sponsorTemporalDecay';
export { computePacingWindow } from './sponsorTemporalPacing';

/** Project several future ticks at once. */
export function projectFutureState(
  campaignSnapshot: SponsorCampaignSnapshot,
  fromTick: number,
  horizon: number,
  options: TemporalProjectionOptions = {},
): ReadonlyArray<TemporalSnapshot> {
  const start = Math.max(0, Math.trunc(fromTick));
  const h = Math.max(0, Math.trunc(horizon));
  const out: TemporalSnapshot[] = [];
  for (let i = 0; i <= h; i++) {
    out.push(buildTemporalSnapshot(campaignSnapshot, start + i, options));
  }
  return Object.freeze(out);
}

/** Idempotent — snapshots are already locked; this is a verification helper. */
export function lockTemporalFrame(snapshot: TemporalSnapshot): TemporalSnapshot {
  assertTemporalSnapshotLocked(snapshot);
  return snapshot;
}
