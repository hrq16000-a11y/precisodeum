/**
 * Phase 1.9.36 — Sponsor Deterministic Equilibrium Snapshot.
 */
import { deepFreeze, signObject } from './sponsorEquilibriumInternals';
import type { SponsorEquilibriumInvariantRegistry } from './sponsorEquilibriumInvariants';
import type { SponsorUniversalSaturationProofs } from './sponsorUniversalSaturationProofs';
import type { SponsorEquilibriumGraph } from './sponsorEquilibriumGraph';
import type { SponsorSaturationLineage } from './sponsorSaturationLineage';

export interface SponsorDeterministicEquilibriumSnapshot {
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

export function generateEquilibriumSnapshot(
  invariants: SponsorEquilibriumInvariantRegistry,
  proofs: SponsorUniversalSaturationProofs,
  graph: SponsorEquilibriumGraph,
  lineage: SponsorSaturationLineage,
): SponsorDeterministicEquilibriumSnapshot {
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
