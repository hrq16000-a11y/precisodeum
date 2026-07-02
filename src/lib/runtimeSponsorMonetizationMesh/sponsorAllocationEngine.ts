/**
 * Phase 1.9.14 — Allocation engine. Deterministic slot → sponsor binding.
 * Honours fairness floor, dominance cap, saturation, and contextual ranking.
 */
import type {
  SponsorAllocationPolicy,
  SponsorAllocationResult,
  SponsorExposureEvent,
  SponsorFairnessLedger,
  SponsorNode,
  SponsorQualityIndex,
  SponsorSaturationMap,
  SponsorSlot,
} from './sponsorMeshTypes';
import { deepFreeze } from './sponsorMeshInternals';
import { rankCandidates } from './sponsorRankingModel';
import { isSponsorSaturated } from './sponsorSaturationController';

function fairnessFor(
  ledger: SponsorFairnessLedger,
  sponsorId: string,
  city: string,
  category: string,
): number {
  for (const e of ledger.entries) {
    if (e.sponsorId === sponsorId && e.city === city && e.category === category) {
      return e.fairnessScore;
    }
  }
  return 1;
}

function grantedShareFor(
  ledger: SponsorFairnessLedger,
  sponsorId: string,
  city: string,
  category: string,
): number {
  for (const e of ledger.entries) {
    if (e.sponsorId === sponsorId && e.city === city && e.category === category) {
      return e.grantedShare;
    }
  }
  return 0;
}

export function allocateSlot(
  slot: SponsorSlot,
  nodes: ReadonlyArray<SponsorNode>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  quality: ReadonlyArray<SponsorQualityIndex>,
  fairness: SponsorFairnessLedger,
  saturation: SponsorSaturationMap,
  policy: SponsorAllocationPolicy,
): SponsorAllocationResult {
  const ranked = rankCandidates(nodes, slot, exposures, quality);
  if (ranked.length === 0) {
    return deepFreeze({
      slotId: slot.id,
      sponsorId: null,
      score: 0,
      reason: 'no_candidates',
    });
  }

  for (const candidate of ranked) {
    if (isSponsorSaturated(saturation, candidate.sponsorId, slot.city, slot.category)) {
      continue;
    }
    const share = grantedShareFor(fairness, candidate.sponsorId, slot.city, slot.category);
    if (share >= policy.maxShareDominance) {
      continue;
    }
    const fScore = fairnessFor(fairness, candidate.sponsorId, slot.city, slot.category);
    const adjusted = candidate.score * (0.5 + 0.5 * fScore);
    return deepFreeze({
      slotId: slot.id,
      sponsorId: candidate.sponsorId,
      score: adjusted,
      reason: 'allocated',
    });
  }

  // fallback — fairness floor: pick the lowest-share active candidate
  const sorted = [...ranked].sort((a, b) => {
    const sa = grantedShareFor(fairness, a.sponsorId, slot.city, slot.category);
    const sb = grantedShareFor(fairness, b.sponsorId, slot.city, slot.category);
    if (sa !== sb) return sa - sb;
    return a.sponsorId.localeCompare(b.sponsorId);
  });
  for (const c of sorted) {
    if (!isSponsorSaturated(saturation, c.sponsorId, slot.city, slot.category)) {
      return deepFreeze({
        slotId: slot.id,
        sponsorId: c.sponsorId,
        score: c.score * 0.25,
        reason: 'fairness_floor',
      });
    }
  }

  return deepFreeze({
    slotId: slot.id,
    sponsorId: null,
    score: 0,
    reason: 'saturated',
  });
}

export function allocateAll(
  slots: ReadonlyArray<SponsorSlot>,
  nodes: ReadonlyArray<SponsorNode>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  quality: ReadonlyArray<SponsorQualityIndex>,
  fairness: SponsorFairnessLedger,
  saturation: SponsorSaturationMap,
  policy: SponsorAllocationPolicy,
): ReadonlyArray<SponsorAllocationResult> {
  const ordered = [...slots].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );
  return deepFreeze(
    ordered.map((s) =>
      allocateSlot(s, nodes, exposures, quality, fairness, saturation, policy),
    ),
  );
}
