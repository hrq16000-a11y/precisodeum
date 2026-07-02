/**
 * Phase 1.9.14 — Sponsor ranking (deterministic, conversion-weighted simulation).
 * Uses only runtime-derived signals. No external data, no billing weights.
 */
import type {
  SponsorNode,
  SponsorSlot,
  SponsorExposureEvent,
  SponsorQualityIndex,
} from './sponsorMeshTypes';
import { clamp01, deepFreeze } from './sponsorMeshInternals';

const TIER_WEIGHT: Record<SponsorNode['tier'], number> = {
  basic: 0.5,
  pro: 0.75,
  premium: 1,
};

export interface RankedCandidate {
  readonly sponsorId: string;
  readonly score: number;
  readonly components: Readonly<{
    contextual: number;
    quality: number;
    tier: number;
    exposurePenalty: number;
  }>;
}

function contextualMatch(node: SponsorNode, slot: SponsorSlot): number {
  const cityMatch = node.city === slot.city ? 1 : 0;
  const categoryMatch = node.category === slot.category ? 1 : 0;
  return clamp01(cityMatch * 0.5 + categoryMatch * 0.5);
}

function exposureCount(
  exposures: ReadonlyArray<SponsorExposureEvent>,
  sponsorId: string,
  slotId: string,
): number {
  let n = 0;
  for (const e of exposures) {
    if (e.sponsorId === sponsorId && e.slotId === slotId) n++;
  }
  return n;
}

export function rankCandidates(
  nodes: ReadonlyArray<SponsorNode>,
  slot: SponsorSlot,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  qualityIndex: ReadonlyArray<SponsorQualityIndex>,
): ReadonlyArray<RankedCandidate> {
  const qMap = new Map(qualityIndex.map((q) => [q.sponsorId, q.score]));
  const ranked: RankedCandidate[] = [];

  for (const node of nodes) {
    if (!node.active) continue;
    const contextual = contextualMatch(node, slot);
    if (contextual === 0) continue;

    const quality = clamp01(qMap.get(node.id) ?? node.qualityIndex);
    const tier = TIER_WEIGHT[node.tier];
    const expCount = exposureCount(exposures, node.id, slot.id);
    const exposurePenalty = clamp01(expCount / 10); // soft cap

    const score = clamp01(
      contextual * 0.4 + quality * 0.3 + tier * 0.2 - exposurePenalty * 0.1,
    );

    ranked.push(
      deepFreeze({
        sponsorId: node.id,
        score,
        components: { contextual, quality, tier, exposurePenalty },
      }),
    );
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sponsorId.localeCompare(b.sponsorId);
  });

  return deepFreeze(ranked);
}
