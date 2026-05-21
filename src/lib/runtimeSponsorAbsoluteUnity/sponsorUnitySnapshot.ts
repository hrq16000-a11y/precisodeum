/**
 * Phase 1.9.37 — Sponsor Deterministic Unity Snapshot.
 */
import { deepFreeze, signObject } from './sponsorUnityInternals';
import type { SponsorUnityInvariantRegistry } from './sponsorUnityInvariants';
import type { SponsorSelfEquivalenceProofs } from './sponsorSelfEquivalenceProofs';
import type { SponsorUnityGraph } from './sponsorUnityGraph';
import type { SponsorUnityLineage } from './sponsorUnityLineage';

export interface SponsorDeterministicUnitySnapshot {
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

export function generateUnitySnapshot(
  invariants: SponsorUnityInvariantRegistry,
  proofs: SponsorSelfEquivalenceProofs,
  graph: SponsorUnityGraph,
  lineage: SponsorUnityLineage,
): SponsorDeterministicUnitySnapshot {
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
