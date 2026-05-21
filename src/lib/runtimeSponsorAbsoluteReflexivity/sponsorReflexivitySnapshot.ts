/**
 * Phase 1.9.38 — Sponsor Deterministic Reflexivity Snapshot.
 */
import { deepFreeze, signObject } from './sponsorReflexivityInternals';
import type { SponsorReflexivityInvariantRegistry } from './sponsorReflexivityInvariants';
import type { SponsorRecursiveCompletenessProofs } from './sponsorRecursiveCompletenessProofs';
import type { SponsorReflexivityGraph } from './sponsorReflexivityGraph';
import type { SponsorReflexivityLineage } from './sponsorReflexiveLineage';

export interface SponsorDeterministicReflexivitySnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
  readonly snapshotSignature: string;
}

export function generateReflexivitySnapshot(
  invariants: SponsorReflexivityInvariantRegistry,
  proofs: SponsorRecursiveCompletenessProofs,
  graph: SponsorReflexivityGraph,
  lineage: SponsorReflexivityLineage,
): SponsorDeterministicReflexivitySnapshot {
  const payload = {
    invariantsSignature: invariants.invariantsSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    terminalSignature: lineage.terminalSignature,
  };
  return deepFreeze({
    version: 'v1' as const,
    ...payload,
    snapshotSignature: signObject(payload),
  });
}
