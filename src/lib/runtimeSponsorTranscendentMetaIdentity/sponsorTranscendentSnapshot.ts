/**
 * Phase 1.9.43 — Sponsor Deterministic Transcendent Snapshot.
 */
import { deepFreeze, signObject } from './sponsorTranscendentInternals';
import type { SponsorTranscendentInvariantRegistry } from './sponsorTranscendentInvariants';
import type { SponsorUniversalSelfEquivalenceProofs } from './sponsorUniversalSelfEquivalenceProofs';
import type { SponsorTranscendentIdentityGraph } from './sponsorTranscendentIdentityGraph';
import type { SponsorTranscendentLineage } from './sponsorTranscendentLineage';

export interface SponsorDeterministicTranscendentSnapshot {
  readonly version: 'v1';
  readonly invariantsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly transcendentSignature: string;
  readonly snapshotSignature: string;
}

export function generateTranscendentSnapshot(
  invariants: SponsorTranscendentInvariantRegistry,
  proofs: SponsorUniversalSelfEquivalenceProofs,
  graph: SponsorTranscendentIdentityGraph,
  lineage: SponsorTranscendentLineage,
): SponsorDeterministicTranscendentSnapshot {
  const payload = {
    invariantsSignature: invariants.invariantsSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    transcendentSignature: lineage.transcendentSignature,
  };
  return deepFreeze({
    version: 'v1' as const,
    ...payload,
    snapshotSignature: signObject(payload),
  });
}
