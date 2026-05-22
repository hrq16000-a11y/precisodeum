/**
 * Phase 1.9.41 — Sponsor Deterministic Singularity Snapshot.
 */
import { deepFreeze, signObject } from './sponsorSingularityInternals';
import type { SponsorSingularityInvariantRegistry } from './sponsorSingularityInvariants';
import type { SponsorCanonicalCollapseProofs } from './sponsorCanonicalCollapseProofs';
import type { SponsorSingularityGraph } from './sponsorSingularityGraph';
import type { SponsorSingularityLineage } from './sponsorSingularityLineage';

export interface SponsorDeterministicSingularitySnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly singularitySignature: string;
  readonly snapshotSignature: string;
}

export function generateSingularitySnapshot(
  invariants: SponsorSingularityInvariantRegistry,
  proofs: SponsorCanonicalCollapseProofs,
  graph: SponsorSingularityGraph,
  lineage: SponsorSingularityLineage,
): SponsorDeterministicSingularitySnapshot {
  const payload = {
    invariantsSignature: invariants.invariantsSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    singularitySignature: lineage.singularitySignature,
  };
  return deepFreeze({
    version: 'v1' as const,
    ...payload,
    snapshotSignature: signObject(payload),
  });
}
