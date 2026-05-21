/**
 * Phase 1.9.21 — Sponsor Distributed Consistency · Drift detector.
 * Detects deterministic divergence between cross-node parity frames.
 * Never corrects. Only reports.
 */
import type { SponsorCrossNodeEquivalenceResult } from './sponsorCrossNodeEquivalence';
import { SponsorConsistencyDriftError } from './sponsorConsistencyInternals';

export interface SponsorDeterminismDriftReport {
  readonly hasDrift: boolean;
  readonly driftCount: number;
  readonly divergentNodes: ReadonlyArray<string>;
  readonly reasons: ReadonlyArray<string>;
}

export function detectDeterministicDrift(
  equivalence: SponsorCrossNodeEquivalenceResult,
): SponsorDeterminismDriftReport {
  const divergentNodes = Array.from(new Set(equivalence.divergences.map((d) => d.nodeId))).sort();
  const reasons = Array.from(new Set(equivalence.divergences.map((d) => d.reason))).sort();
  return Object.freeze({
    hasDrift: equivalence.divergences.length > 0,
    driftCount: equivalence.divergences.length,
    divergentNodes: Object.freeze(divergentNodes),
    reasons: Object.freeze(reasons),
  });
}

export function assertNoDeterministicDrift(
  equivalence: SponsorCrossNodeEquivalenceResult,
): void {
  const report = detectDeterministicDrift(equivalence);
  if (report.hasDrift) {
    throw new SponsorConsistencyDriftError(
      `deterministic drift detected on nodes [${report.divergentNodes.join(',')}]: ${report.reasons.join('; ')}`,
    );
  }
}
