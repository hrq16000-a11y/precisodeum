/**
 * Phase 1.9.36 — Sponsor Terminal Equilibrium Envelope.
 */
import {
  SPONSOR_EQUILIBRIUM_INTERNALS,
  SponsorEquilibriumMutationError,
  deepFreeze,
  signObject,
} from './sponsorEquilibriumInternals';
import type { SponsorEquilibriumInvariantRegistry } from './sponsorEquilibriumInvariants';
import type { SponsorUniversalSaturationProofs } from './sponsorUniversalSaturationProofs';
import type { SponsorEquilibriumGraph } from './sponsorEquilibriumGraph';
import type { SponsorSaturationLineage } from './sponsorSaturationLineage';
import type { SponsorDeterministicEquilibriumSnapshot } from './sponsorEquilibriumSnapshot';

export interface SponsorTerminalEquilibriumEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorEquilibriumInvariantRegistry;
  readonly proofs: SponsorUniversalSaturationProofs;
  readonly graph: SponsorEquilibriumGraph;
  readonly lineage: SponsorSaturationLineage;
  readonly snapshot: SponsorDeterministicEquilibriumSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildTerminalEquilibriumEnvelope(
  invariants: SponsorEquilibriumInvariantRegistry,
  proofs: SponsorUniversalSaturationProofs,
  graph: SponsorEquilibriumGraph,
  lineage: SponsorSaturationLineage,
  snapshot: SponsorDeterministicEquilibriumSnapshot,
): SponsorTerminalEquilibriumEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_EQUILIBRIUM_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockEquilibriumEnvelope(env: SponsorTerminalEquilibriumEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorEquilibriumMutationError('envelope must be frozen and locked');
  }
}
