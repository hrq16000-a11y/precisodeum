/**
 * Phase 1.9.41 — Sponsor Canonical Singularity Envelope.
 */
import {
  SPONSOR_SINGULARITY_INTERNALS,
  SponsorSingularityMutationError,
  deepFreeze,
  signObject,
} from './sponsorSingularityInternals';
import type { SponsorSingularityInvariantRegistry } from './sponsorSingularityInvariants';
import type { SponsorCanonicalCollapseProofs } from './sponsorCanonicalCollapseProofs';
import type { SponsorSingularityGraph } from './sponsorSingularityGraph';
import type { SponsorSingularityLineage } from './sponsorSingularityLineage';
import type { SponsorDeterministicSingularitySnapshot } from './sponsorSingularitySnapshot';

export interface SponsorCanonicalSingularityEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorSingularityInvariantRegistry;
  readonly proofs: SponsorCanonicalCollapseProofs;
  readonly graph: SponsorSingularityGraph;
  readonly lineage: SponsorSingularityLineage;
  readonly snapshot: SponsorDeterministicSingularitySnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildCanonicalSingularityEnvelope(
  invariants: SponsorSingularityInvariantRegistry,
  proofs: SponsorCanonicalCollapseProofs,
  graph: SponsorSingularityGraph,
  lineage: SponsorSingularityLineage,
  snapshot: SponsorDeterministicSingularitySnapshot,
): SponsorCanonicalSingularityEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_SINGULARITY_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockSingularityEnvelope(env: SponsorCanonicalSingularityEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorSingularityMutationError('envelope must be frozen and locked');
  }
}
