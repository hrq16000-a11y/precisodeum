/**
 * Phase 1.9.38 — Sponsor Absolute Reflexivity Envelope.
 */
import {
  SPONSOR_REFLEXIVITY_INTERNALS,
  SponsorReflexivityMutationError,
  deepFreeze,
  signObject,
} from './sponsorReflexivityInternals';
import type { SponsorReflexivityInvariantRegistry } from './sponsorReflexivityInvariants';
import type { SponsorRecursiveCompletenessProofs } from './sponsorRecursiveCompletenessProofs';
import type { SponsorReflexivityGraph } from './sponsorReflexivityGraph';
import type { SponsorReflexivityLineage } from './sponsorReflexiveLineage';
import type { SponsorDeterministicReflexivitySnapshot } from './sponsorReflexivitySnapshot';

export interface SponsorAbsoluteReflexivityEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorReflexivityInvariantRegistry;
  readonly proofs: SponsorRecursiveCompletenessProofs;
  readonly graph: SponsorReflexivityGraph;
  readonly lineage: SponsorReflexivityLineage;
  readonly snapshot: SponsorDeterministicReflexivitySnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildAbsoluteReflexivityEnvelope(
  invariants: SponsorReflexivityInvariantRegistry,
  proofs: SponsorRecursiveCompletenessProofs,
  graph: SponsorReflexivityGraph,
  lineage: SponsorReflexivityLineage,
  snapshot: SponsorDeterministicReflexivitySnapshot,
): SponsorAbsoluteReflexivityEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_REFLEXIVITY_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockReflexivityEnvelope(env: SponsorAbsoluteReflexivityEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorReflexivityMutationError('envelope must be frozen and locked');
  }
}
