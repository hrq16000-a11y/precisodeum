/**
 * Phase 1.9.35 — Sponsor Deterministic Coherence Snapshot.
 */
import { deepFreeze, signObject } from './sponsorCoherenceInternals';
import type { SponsorCoherenceInvariantRegistry } from './sponsorCoherenceInvariants';
import type { SponsorOntologicalCompletenessProofs } from './sponsorOntologicalCompletenessProofs';
import type { SponsorCompletenessGraph } from './sponsorCompletenessGraph';
import type { SponsorCompletenessLineage } from './sponsorCompletenessLineage';

export interface SponsorDeterministicCoherenceSnapshot {
  readonly version: 'v1';
  readonly layerCount: number;
  readonly invariantCount: number;
  readonly proofCount: number;
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
  readonly snapshotSignature: string;
}

export function generateCoherenceSnapshot(
  invariants: SponsorCoherenceInvariantRegistry,
  proofs: SponsorOntologicalCompletenessProofs,
  graph: SponsorCompletenessGraph,
  lineage: SponsorCompletenessLineage,
): SponsorDeterministicCoherenceSnapshot {
  const snapshotSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    terminal: lineage.terminalSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    layerCount: proofs.descriptors.length,
    invariantCount: invariants.invariants.length,
    proofCount: proofs.proofs.length,
    invariantsSignature: invariants.invariantsSignature,
    proofsSignature: proofs.proofsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    terminalSignature: lineage.terminalSignature,
    snapshotSignature,
  });
}
