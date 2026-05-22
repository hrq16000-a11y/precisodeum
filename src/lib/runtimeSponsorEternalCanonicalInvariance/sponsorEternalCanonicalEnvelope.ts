/**
 * Phase 1.9.42 — Sponsor Eternal Canonical Envelope.
 */
import {
  SPONSOR_ETERNAL_INTERNALS,
  SponsorEternalMutationError,
  deepFreeze,
  signObject,
} from './sponsorEternalInternals';
import type { SponsorEternalInvariantRegistry } from './sponsorEternalInvariants';
import type { SponsorPermanentStabilityProofs } from './sponsorPermanentStabilityProofs';
import type { SponsorPermanentInvarianceGraph } from './sponsorPermanentInvarianceGraph';
import type { SponsorEternalLineage } from './sponsorEternalLineage';
import type { SponsorDeterministicEternalSnapshot } from './sponsorEternalSnapshot';

export interface SponsorEternalCanonicalEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorEternalInvariantRegistry;
  readonly proofs: SponsorPermanentStabilityProofs;
  readonly graph: SponsorPermanentInvarianceGraph;
  readonly lineage: SponsorEternalLineage;
  readonly snapshot: SponsorDeterministicEternalSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildEternalCanonicalEnvelope(
  invariants: SponsorEternalInvariantRegistry,
  proofs: SponsorPermanentStabilityProofs,
  graph: SponsorPermanentInvarianceGraph,
  lineage: SponsorEternalLineage,
  snapshot: SponsorDeterministicEternalSnapshot,
): SponsorEternalCanonicalEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_ETERNAL_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockEternalEnvelope(env: SponsorEternalCanonicalEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorEternalMutationError('envelope must be frozen and locked');
  }
}
