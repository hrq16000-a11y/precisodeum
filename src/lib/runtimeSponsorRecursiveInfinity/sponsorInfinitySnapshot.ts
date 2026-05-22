/**
 * Phase 1.9.44 — Sponsor Deterministic Infinity Snapshot.
 */
import { deepFreeze, signObject } from './sponsorInfinityInternals';
import type { SponsorInfinityInvariantRegistry } from './sponsorInfinityInvariants';
import type { SponsorRecursiveContainmentProofs } from './sponsorRecursiveContainmentProofs';
import type { SponsorRecursiveInfinityGraph } from './sponsorRecursiveInfinityGraph';
import type { SponsorInfinityLineage } from './sponsorInfinityLineage';

export interface SponsorDeterministicInfinitySnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly infinitySignature: string;
  readonly snapshotSignature: string;
}

export function generateInfinitySnapshot(
  invariants: SponsorInfinityInvariantRegistry,
  proofs: SponsorRecursiveContainmentProofs,
  graph: SponsorRecursiveInfinityGraph,
  lineage: SponsorInfinityLineage,
): SponsorDeterministicInfinitySnapshot {
  const payload = {
    invariantsSignature: invariants.invariantsSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    infinitySignature: lineage.infinitySignature,
  };
  return deepFreeze({
    version: 'v1' as const,
    ...payload,
    snapshotSignature: signObject(payload),
  });
}
