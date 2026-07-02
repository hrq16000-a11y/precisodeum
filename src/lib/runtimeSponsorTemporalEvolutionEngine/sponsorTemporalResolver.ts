/**
 * Phase 1.9.17 — Resolver / integration helpers.
 * Read-only correlation between temporal frames and decision/campaign layers.
 * NEVER mutates upstream snapshots.
 */
import type { SponsorCampaignSnapshot } from '@/lib/runtimeSponsorCampaignLayer';
import type { SponsorDecisionSnapshot } from '@/lib/runtimeSponsorDecisionFinalizer';
import type { EvolutionFrame, TemporalSnapshot } from './sponsorTemporalModel';

/**
 * Map slotId -> projected exposure (derived from temporal frame of the assigned campaign).
 * Returns null exposure when no campaign maps to the assigned sponsor.
 */
export function correlateDecisionWithTemporalFrames(
  decision: SponsorDecisionSnapshot,
  campaignSnapshot: SponsorCampaignSnapshot,
  temporalSnapshot: TemporalSnapshot,
): Readonly<Record<string, number | null>> {
  const frameByCampaign: Record<string, EvolutionFrame> = {};
  for (const f of temporalSnapshot.frames) {
    frameByCampaign[f.campaignId] = f;
  }
  const out: Record<string, number | null> = {};
  for (const entry of decision.entries) {
    const sid = entry.sponsorId;
    if (!sid) {
      out[entry.slotId] = null;
      continue;
    }
    const campaignId = campaignSnapshot.nodeToCampaign[sid] ?? null;
    if (!campaignId) {
      out[entry.slotId] = null;
      continue;
    }
    const frame = frameByCampaign[campaignId];
    out[entry.slotId] = frame ? frame.projectedExposure : null;
  }
  return Object.freeze(out);
}

export function listFramesByLifecycle(
  snapshot: TemporalSnapshot,
  lifecycle: EvolutionFrame['timeSlice']['projectedLifecycle'],
): ReadonlyArray<EvolutionFrame> {
  return Object.freeze(
    snapshot.frames.filter((f) => f.timeSlice.projectedLifecycle === lifecycle),
  );
}
