/**
 * Phase 1.9.16 — Campaign Builder.
 * Deterministically groups SponsorNodes into SponsorCampaigns.
 * Grouping key: (category, city, tier-bucket?) — we group strictly by (category, city)
 * so all nodes targeting the same scope form one logical campaign.
 * NO decisional logic. NO mutation of input nodes.
 */
import type { SponsorNode } from '@/lib/runtimeSponsorMonetizationMesh';
import type {
  SponsorCampaign,
  SponsorCampaignExposureIntentVector,
  SponsorCampaignGroupingInput,
  SponsorCampaignLifecycle,
} from './sponsorCampaignModel';
import { clamp01, deepFreeze, signCampaignPayload } from './sponsorCampaignSnapshot';

const TIER_WEIGHT: Record<SponsorNode['tier'], number> = Object.freeze({
  basic: 0.33,
  pro: 0.66,
  premium: 1.0,
}) as Record<SponsorNode['tier'], number>;

function groupKey(category: string, city: string): string {
  return `${category}::${city}`;
}

function deriveLifecycle(nodes: ReadonlyArray<SponsorNode>): SponsorCampaignLifecycle {
  if (nodes.length === 0) return 'DRAFT';
  const hasActive = nodes.some((n) => n.active);
  const allInactive = nodes.every((n) => !n.active);
  if (allInactive) return 'PAUSED';
  if (hasActive) return 'ACTIVE';
  return 'DRAFT';
}

function deriveIntent(nodes: ReadonlyArray<SponsorNode>): SponsorCampaignExposureIntentVector {
  if (nodes.length === 0) {
    return Object.freeze({ intensity: 0, premiumShare: 0, proShare: 0, basicShare: 0 });
  }
  let intensitySum = 0;
  let premium = 0;
  let pro = 0;
  let basic = 0;
  for (const n of nodes) {
    intensitySum += clamp01(n.qualityIndex) * TIER_WEIGHT[n.tier];
    if (n.tier === 'premium') premium++;
    else if (n.tier === 'pro') pro++;
    else basic++;
  }
  const len = nodes.length;
  return Object.freeze({
    intensity: clamp01(intensitySum / len),
    premiumShare: clamp01(premium / len),
    proShare: clamp01(pro / len),
    basicShare: clamp01(basic / len),
  });
}

function deriveWeight(nodes: ReadonlyArray<SponsorNode>): number {
  if (nodes.length === 0) return 0;
  let sum = 0;
  for (const n of nodes) sum += clamp01(n.qualityIndex) * TIER_WEIGHT[n.tier];
  return clamp01(sum / nodes.length);
}

export function buildCampaigns(input: SponsorCampaignGroupingInput): ReadonlyArray<SponsorCampaign> {
  const horizon = input.horizon ?? { startTick: 0, endTick: 0 };
  const buckets = new Map<string, SponsorNode[]>();

  // Stable input order
  const sortedNodes = [...input.nodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const node of sortedNodes) {
    const key = groupKey(node.category, node.city);
    const existing = buckets.get(key);
    if (existing) existing.push(node);
    else buckets.set(key, [node]);
  }

  // Stable key ordering
  const keys = [...buckets.keys()].sort();
  const campaigns: SponsorCampaign[] = keys.map((key) => {
    const bucketNodes = buckets.get(key)!;
    const nodeIds = bucketNodes.map((n) => n.id).sort();
    const categoryScope = [...new Set(bucketNodes.map((n) => n.category))].sort();
    const geoScope = [...new Set(bucketNodes.map((n) => n.city))].sort();
    const intent = deriveIntent(bucketNodes);
    const lifecycle = deriveLifecycle(bucketNodes);
    const weight = deriveWeight(bucketNodes);
    const eligibility = Object.freeze({
      startTick: horizon.startTick,
      endTick: horizon.endTick,
    });

    const corePayload = {
      key,
      nodeIds,
      categoryScope,
      geoScope,
      intent,
      lifecycle,
      eligibility,
      weight,
    };
    const signature = signCampaignPayload(corePayload);
    const campaignId = `camp_${signature}`;

    const campaign: SponsorCampaign = {
      campaignId,
      sponsorNodeIds: Object.freeze(nodeIds),
      categoryScope: Object.freeze(categoryScope),
      geoScope: Object.freeze(geoScope),
      exposureIntentVector: intent,
      lifecycleState: lifecycle,
      allocationEligibilityWindow: eligibility,
      derivedCampaignWeight: weight,
      snapshotSignature: signature,
    };
    return Object.freeze(campaign);
  });

  return deepFreeze(campaigns);
}

export function buildNodeToCampaignMap(
  campaigns: ReadonlyArray<SponsorCampaign>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of campaigns) {
    for (const nid of c.sponsorNodeIds) out[nid] = c.campaignId;
  }
  return Object.freeze(out);
}
