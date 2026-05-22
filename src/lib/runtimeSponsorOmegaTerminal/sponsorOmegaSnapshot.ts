/**
 * Phase 1.9.40 — Sponsor Deterministic Omega Snapshot.
 */
import { deepFreeze, signObject } from './sponsorOmegaInternals';
import type { SponsorOmegaInvariantRegistry } from './sponsorOmegaInvariants';
import type { SponsorIrreducibleCompletenessProofs } from './sponsorIrreducibleCompletenessProofs';
import type { SponsorOmegaGraph } from './sponsorOmegaGraph';
import type { SponsorOmegaLineage } from './sponsorOmegaLineage';

export interface SponsorDeterministicOmegaSnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
  readonly snapshotSignature: string;
}

export function generateOmegaSnapshot(
  invariants: SponsorOmegaInvariantRegistry,
  proofs: SponsorIrreducibleCompletenessProofs,
  graph: SponsorOmegaGraph,
  lineage: SponsorOmegaLineage,
): SponsorDeterministicOmegaSnapshot {
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
