/**
 * Phase 1.9.44 — Sponsor Infinity Envelope.
 */
import {
  SPONSOR_INFINITY_INTERNALS,
  SponsorInfinityMutationError,
  deepFreeze,
  signObject,
} from './sponsorInfinityInternals';
import type { SponsorInfinityInvariantRegistry } from './sponsorInfinityInvariants';
import type { SponsorRecursiveContainmentProofs } from './sponsorRecursiveContainmentProofs';
import type { SponsorRecursiveInfinityGraph } from './sponsorRecursiveInfinityGraph';
import type { SponsorInfinityLineage } from './sponsorInfinityLineage';
import type { SponsorDeterministicInfinitySnapshot } from './sponsorInfinitySnapshot';

export interface SponsorInfinityEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorInfinityInvariantRegistry;
  readonly proofs: SponsorRecursiveContainmentProofs;
  readonly graph: SponsorRecursiveInfinityGraph;
  readonly lineage: SponsorInfinityLineage;
  readonly snapshot: SponsorDeterministicInfinitySnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildInfinityEnvelope(
  invariants: SponsorInfinityInvariantRegistry,
  proofs: SponsorRecursiveContainmentProofs,
  graph: SponsorRecursiveInfinityGraph,
  lineage: SponsorInfinityLineage,
  snapshot: SponsorDeterministicInfinitySnapshot,
): SponsorInfinityEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_INFINITY_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockInfinityEnvelope(env: SponsorInfinityEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorInfinityMutationError('envelope must be frozen and locked');
  }
}
