/**
 * Phase 1.9.39 — Sponsor Deterministic Closure-Unity Snapshot.
 */
import { deepFreeze, signObject } from './sponsorClosureUnityInternals';
import type { SponsorClosureUnityInvariantRegistry } from './sponsorClosureUnityInvariants';
import type { SponsorSelfContainmentProofs } from './sponsorSelfContainmentProofs';
import type { SponsorClosureUnityGraph } from './sponsorClosureUnityGraph';
import type { SponsorClosureUnityLineage } from './sponsorClosureUnityLineage';

export interface SponsorDeterministicClosureUnitySnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
  readonly snapshotSignature: string;
}

export function generateClosureUnitySnapshot(
  invariants: SponsorClosureUnityInvariantRegistry,
  proofs: SponsorSelfContainmentProofs,
  graph: SponsorClosureUnityGraph,
  lineage: SponsorClosureUnityLineage,
): SponsorDeterministicClosureUnitySnapshot {
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
