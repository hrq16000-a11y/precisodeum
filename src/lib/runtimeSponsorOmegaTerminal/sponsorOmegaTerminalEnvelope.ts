/**
 * Phase 1.9.40 — Sponsor Omega Terminal Envelope.
 */
import {
  SPONSOR_OMEGA_INTERNALS,
  SponsorOmegaMutationError,
  deepFreeze,
  signObject,
} from './sponsorOmegaInternals';
import type { SponsorOmegaInvariantRegistry } from './sponsorOmegaInvariants';
import type { SponsorIrreducibleCompletenessProofs } from './sponsorIrreducibleCompletenessProofs';
import type { SponsorOmegaGraph } from './sponsorOmegaGraph';
import type { SponsorOmegaLineage } from './sponsorOmegaLineage';
import type { SponsorDeterministicOmegaSnapshot } from './sponsorOmegaSnapshot';

export interface SponsorOmegaTerminalEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorOmegaInvariantRegistry;
  readonly proofs: SponsorIrreducibleCompletenessProofs;
  readonly graph: SponsorOmegaGraph;
  readonly lineage: SponsorOmegaLineage;
  readonly snapshot: SponsorDeterministicOmegaSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildOmegaTerminalEnvelope(
  invariants: SponsorOmegaInvariantRegistry,
  proofs: SponsorIrreducibleCompletenessProofs,
  graph: SponsorOmegaGraph,
  lineage: SponsorOmegaLineage,
  snapshot: SponsorDeterministicOmegaSnapshot,
): SponsorOmegaTerminalEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_OMEGA_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockOmegaEnvelope(env: SponsorOmegaTerminalEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorOmegaMutationError('envelope must be frozen and locked');
  }
}
