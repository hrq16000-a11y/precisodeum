/**
 * Phase 1.9.42 — Sponsor Deterministic Eternal Snapshot.
 */
import { deepFreeze, signObject } from './sponsorEternalInternals';
import type { SponsorEternalInvariantRegistry } from './sponsorEternalInvariants';
import type { SponsorPermanentStabilityProofs } from './sponsorPermanentStabilityProofs';
import type { SponsorPermanentInvarianceGraph } from './sponsorPermanentInvarianceGraph';
import type { SponsorEternalLineage } from './sponsorEternalLineage';

export interface SponsorDeterministicEternalSnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly eternalSignature: string;
  readonly snapshotSignature: string;
}

export function generateEternalSnapshot(
  invariants: SponsorEternalInvariantRegistry,
  proofs: SponsorPermanentStabilityProofs,
  graph: SponsorPermanentInvarianceGraph,
  lineage: SponsorEternalLineage,
): SponsorDeterministicEternalSnapshot {
  const payload = {
    invariantsSignature: invariants.invariantsSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    eternalSignature: lineage.eternalSignature,
  };
  return deepFreeze({
    version: 'v1' as const,
    ...payload,
    snapshotSignature: signObject(payload),
  });
}
