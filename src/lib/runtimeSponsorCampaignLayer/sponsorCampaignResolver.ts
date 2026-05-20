/**
 * Phase 1.9.16 — Campaign Resolver.
 * Resolves campaigns from a SponsorMeshSnapshot (1.9.14) without altering anything.
 * Also offers a read-only inspection helper against a SponsorDecisionSnapshot (1.9.15).
 */
import type { SponsorMeshSnapshot } from '@/lib/runtimeSponsorMonetizationMesh';
import type { SponsorDecisionSnapshot } from '@/lib/runtimeSponsorDecisionFinalizer';
import type {
  SponsorCampaign,
  SponsorCampaignGroupingInput,
  SponsorCampaignSnapshot,
} from './sponsorCampaignModel';
import { SPONSOR_CAMPAIGN_INTERNALS } from './sponsorCampaignModel';
import {
  assertCampaignSnapshotLocked,
  deepFreeze,
  signCampaignPayload,
} from './sponsorCampaignSnapshot';
import { buildCampaigns, buildNodeToCampaignMap } from './sponsorCampaignBuilder';

export interface ResolveCampaignsOptions {
  readonly horizon?: { readonly startTick: number; readonly endTick: number };
}

export function resolveCampaignsFromMesh(
  mesh: SponsorMeshSnapshot,
  options: ResolveCampaignsOptions = {},
): SponsorCampaignSnapshot {
  const input: SponsorCampaignGroupingInput = {
    nodes: mesh.nodes,
    horizon: options.horizon,
  };
  const campaigns = buildCampaigns(input);
  const nodeToCampaign = buildNodeToCampaignMap(campaigns);

  const signature = signCampaignPayload({
    campaigns,
    nodeToCampaign,
    internals: SPONSOR_CAMPAIGN_INTERNALS,
    meshSignature: mesh.signature,
  });

  const snapshot: SponsorCampaignSnapshot = deepFreeze({
    version: '1.9.16' as const,
    internals: SPONSOR_CAMPAIGN_INTERNALS,
    campaigns,
    nodeToCampaign,
    signature,
    locked: true as const,
  });

  assertCampaignSnapshotLocked(snapshot);
  return snapshot;
}

/**
 * Read-only correlation between a decision snapshot and resolved campaigns.
 * Returns a map { slotId -> campaignId | null } WITHOUT modifying either snapshot.
 */
export function correlateDecisionWithCampaigns(
  decision: SponsorDecisionSnapshot,
  campaignSnapshot: SponsorCampaignSnapshot,
): Readonly<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const entry of decision.entries) {
    const sid = entry.sponsorId;
    out[entry.slotId] = sid ? campaignSnapshot.nodeToCampaign[sid] ?? null : null;
  }
  return Object.freeze(out);
}

export function listCampaignsByLifecycle(
  campaigns: ReadonlyArray<SponsorCampaign>,
  lifecycle: SponsorCampaign['lifecycleState'],
): ReadonlyArray<SponsorCampaign> {
  return Object.freeze(campaigns.filter((c) => c.lifecycleState === lifecycle));
}
