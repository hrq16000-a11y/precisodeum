/**
 * Phase 1.9.37 — Sponsor Absolute Unity Envelope.
 */
import {
  SPONSOR_UNITY_INTERNALS,
  SponsorUnityMutationError,
  deepFreeze,
  signObject,
} from './sponsorUnityInternals';
import type { SponsorUnityInvariantRegistry } from './sponsorUnityInvariants';
import type { SponsorSelfEquivalenceProofs } from './sponsorSelfEquivalenceProofs';
import type { SponsorUnityGraph } from './sponsorUnityGraph';
import type { SponsorUnityLineage } from './sponsorUnityLineage';
import type { SponsorDeterministicUnitySnapshot } from './sponsorUnitySnapshot';

export interface SponsorAbsoluteUnityEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorUnityInvariantRegistry;
  readonly proofs: SponsorSelfEquivalenceProofs;
  readonly graph: SponsorUnityGraph;
  readonly lineage: SponsorUnityLineage;
  readonly snapshot: SponsorDeterministicUnitySnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildAbsoluteUnityEnvelope(
  invariants: SponsorUnityInvariantRegistry,
  proofs: SponsorSelfEquivalenceProofs,
  graph: SponsorUnityGraph,
  lineage: SponsorUnityLineage,
  snapshot: SponsorDeterministicUnitySnapshot,
): SponsorAbsoluteUnityEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_UNITY_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockUnityEnvelope(env: SponsorAbsoluteUnityEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorUnityMutationError('envelope must be frozen and locked');
  }
}
