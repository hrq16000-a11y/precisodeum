/**
 * Phase 1.9.35 — Sponsor Terminal Coherence Envelope.
 */
import {
  SPONSOR_COHERENCE_INTERNALS,
  SponsorCoherenceMutationError,
  deepFreeze,
  signObject,
} from './sponsorCoherenceInternals';
import type { SponsorCoherenceInvariantRegistry } from './sponsorCoherenceInvariants';
import type { SponsorOntologicalCompletenessProofs } from './sponsorOntologicalCompletenessProofs';
import type { SponsorCompletenessGraph } from './sponsorCompletenessGraph';
import type { SponsorCompletenessLineage } from './sponsorCompletenessLineage';
import type { SponsorDeterministicCoherenceSnapshot } from './sponsorCoherenceSnapshot';

export interface SponsorTerminalCoherenceEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorCoherenceInvariantRegistry;
  readonly proofs: SponsorOntologicalCompletenessProofs;
  readonly graph: SponsorCompletenessGraph;
  readonly lineage: SponsorCompletenessLineage;
  readonly snapshot: SponsorDeterministicCoherenceSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildTerminalCoherenceEnvelope(
  invariants: SponsorCoherenceInvariantRegistry,
  proofs: SponsorOntologicalCompletenessProofs,
  graph: SponsorCompletenessGraph,
  lineage: SponsorCompletenessLineage,
  snapshot: SponsorDeterministicCoherenceSnapshot,
): SponsorTerminalCoherenceEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_COHERENCE_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockCoherenceEnvelope(env: SponsorTerminalCoherenceEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorCoherenceMutationError('envelope must be frozen and locked');
  }
}
