/**
 * Phase 1.9.15 — Decision composition.
 * Pure deterministic function:
 *   finalScore = f(ranking, fairness, saturationPenalty, geo, exposureDecay)
 */
import type { NormalizedDecisionInput } from './sponsorDecisionModel';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export const COMPOSITION_WEIGHTS = Object.freeze({
  ranking: 0.45,
  fairness: 0.2,
  geo: 0.15,
  exposureDecay: 0.2,
  saturationPenalty: 0.35, // subtracted
});

export function composeFinalScore(input: NormalizedDecisionInput): number {
  if (!input.sponsorId) return 0;
  const w = COMPOSITION_WEIGHTS;
  const positive =
    input.rankingScore * w.ranking +
    input.fairnessWeight * w.fairness +
    input.geoBalanceFactor * w.geo +
    input.exposureDecayFactor * w.exposureDecay;
  const negative = input.saturationPenalty * w.saturationPenalty;
  return clamp01(positive - negative);
}
