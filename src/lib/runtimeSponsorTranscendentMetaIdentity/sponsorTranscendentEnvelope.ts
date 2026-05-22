/**
 * Phase 1.9.43 — Sponsor Transcendent Envelope.
 */
import {
  SPONSOR_TRANSCENDENT_INTERNALS,
  SponsorTranscendentMutationError,
  deepFreeze,
  signObject,
} from './sponsorTranscendentInternals';
import type { SponsorTranscendentInvariantRegistry } from './sponsorTranscendentInvariants';
import type { SponsorUniversalSelfEquivalenceProofs } from './sponsorUniversalSelfEquivalenceProofs';
import type { SponsorTranscendentIdentityGraph } from './sponsorTranscendentIdentityGraph';
import type { SponsorTranscendentLineage } from './sponsorTranscendentLineage';
import type { SponsorDeterministicTranscendentSnapshot } from './sponsorTranscendentSnapshot';

export interface SponsorTranscendentEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorTranscendentInvariantRegistry;
  readonly proofs: SponsorUniversalSelfEquivalenceProofs;
  readonly graph: SponsorTranscendentIdentityGraph;
  readonly lineage: SponsorTranscendentLineage;
  readonly snapshot: SponsorDeterministicTranscendentSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildTranscendentEnvelope(
  invariants: SponsorTranscendentInvariantRegistry,
  proofs: SponsorUniversalSelfEquivalenceProofs,
  graph: SponsorTranscendentIdentityGraph,
  lineage: SponsorTranscendentLineage,
  snapshot: SponsorDeterministicTranscendentSnapshot,
): SponsorTranscendentEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_TRANSCENDENT_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockTranscendentEnvelope(env: SponsorTranscendentEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorTranscendentMutationError('envelope must be frozen and locked');
  }
}
