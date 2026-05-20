import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface SponsorImpression {
  readonly sponsorId: string;
  readonly slot: string;
  readonly weight: number;
}

export interface SponsorAttribution {
  readonly ranking: ReadonlyArray<{ sponsorId: string; score: number; share: number }>;
  readonly signature: string;
}

export function buildSponsorAttribution(
  impressions: ReadonlyArray<SponsorImpression>,
): SponsorAttribution {
  const acc = new Map<string, number>();
  let total = 0;
  for (const i of impressions) {
    const w = Number.isFinite(i.weight) ? Math.max(0, i.weight) : 0;
    acc.set(i.sponsorId, (acc.get(i.sponsorId) ?? 0) + w);
    total += w;
  }
  const ranking = cloneSorted(
    Array.from(acc.entries()).map(([sponsorId, score]) => ({
      sponsorId,
      score,
      share: total > 0 ? score / total : 0,
    })),
    (a, b) =>
      a.score === b.score
        ? a.sponsorId < b.sponsorId
          ? -1
          : a.sponsorId > b.sponsorId
            ? 1
            : 0
        : b.score - a.score,
  );
  const out = { ranking, signature: sigOf(ranking) };
  return deepFreeze(out);
}
