/**
 * Phase 1.9.14 — Fairness engine. Computes per-sponsor share vs floor & dominance caps.
 */
import type {
  SponsorAllocationPolicy,
  SponsorExposureEvent,
  SponsorFairnessLedger,
  SponsorFairnessLedgerEntry,
  SponsorNode,
} from './sponsorMeshTypes';
import { clamp01, deepFreeze } from './sponsorMeshInternals';

interface Key {
  city: string;
  category: string;
  sponsorId: string;
}

function keyOf(k: Key): string {
  return `${k.city}::${k.category}::${k.sponsorId}`;
}

export function computeFairnessLedger(
  nodes: ReadonlyArray<SponsorNode>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  policy: SponsorAllocationPolicy,
): SponsorFairnessLedger {
  const totals = new Map<string, number>(); // city::category -> total
  const perSponsor = new Map<string, number>(); // key -> count

  for (const e of exposures) {
    const bucket = `${e.city}::${e.category}`;
    totals.set(bucket, (totals.get(bucket) ?? 0) + e.weight);
    const k = keyOf({ city: e.city, category: e.category, sponsorId: e.sponsorId });
    perSponsor.set(k, (perSponsor.get(k) ?? 0) + e.weight);
  }

  const entries: SponsorFairnessLedgerEntry[] = [];
  for (const node of nodes) {
    if (!node.active) continue;
    const bucket = `${node.city}::${node.category}`;
    const total = totals.get(bucket) ?? 0;
    const k = keyOf({ city: node.city, category: node.category, sponsorId: node.id });
    const share = total > 0 ? (perSponsor.get(k) ?? 0) / total : 0;

    // fairness = 1 when share is between floor and dominance cap, decays outside
    let fairnessScore = 1;
    if (share > policy.maxShareDominance) {
      fairnessScore = clamp01(1 - (share - policy.maxShareDominance));
    } else if (share > 0 && share < policy.fairnessFloor) {
      fairnessScore = clamp01(share / Math.max(policy.fairnessFloor, 1e-6));
    }

    entries.push(
      deepFreeze({
        sponsorId: node.id,
        city: node.city,
        category: node.category,
        grantedShare: clamp01(share),
        fairnessScore: clamp01(fairnessScore),
      }),
    );
  }

  entries.sort((a, b) =>
    a.city.localeCompare(b.city) ||
    a.category.localeCompare(b.category) ||
    a.sponsorId.localeCompare(b.sponsorId),
  );

  const aggregateFairness =
    entries.length === 0
      ? 1
      : entries.reduce((acc, e) => acc + e.fairnessScore, 0) / entries.length;

  return deepFreeze({
    entries,
    aggregateFairness: clamp01(aggregateFairness),
  });
}
