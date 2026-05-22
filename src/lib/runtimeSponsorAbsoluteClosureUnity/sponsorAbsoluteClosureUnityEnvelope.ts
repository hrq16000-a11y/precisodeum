/**
 * Phase 1.9.39 — Sponsor Absolute Closure-Unity Envelope.
 */
import {
  SPONSOR_CLOSURE_UNITY_INTERNALS,
  SponsorClosureUnityMutationError,
  deepFreeze,
  signObject,
} from './sponsorClosureUnityInternals';
import type { SponsorClosureUnityInvariantRegistry } from './sponsorClosureUnityInvariants';
import type { SponsorSelfContainmentProofs } from './sponsorSelfContainmentProofs';
import type { SponsorClosureUnityGraph } from './sponsorClosureUnityGraph';
import type { SponsorClosureUnityLineage } from './sponsorClosureUnityLineage';
import type { SponsorDeterministicClosureUnitySnapshot } from './sponsorClosureUnitySnapshot';

export interface SponsorAbsoluteClosureUnityEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly invariants: SponsorClosureUnityInvariantRegistry;
  readonly proofs: SponsorSelfContainmentProofs;
  readonly graph: SponsorClosureUnityGraph;
  readonly lineage: SponsorClosureUnityLineage;
  readonly snapshot: SponsorDeterministicClosureUnitySnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildAbsoluteClosureUnityEnvelope(
  invariants: SponsorClosureUnityInvariantRegistry,
  proofs: SponsorSelfContainmentProofs,
  graph: SponsorClosureUnityGraph,
  lineage: SponsorClosureUnityLineage,
  snapshot: SponsorDeterministicClosureUnitySnapshot,
): SponsorAbsoluteClosureUnityEnvelope {
  const envelopeSignature = signObject({
    invariants: invariants.invariantsSignature,
    proofs: proofs.proofsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_CLOSURE_UNITY_INTERNALS.stage,
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockClosureUnityEnvelope(env: SponsorAbsoluteClosureUnityEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorClosureUnityMutationError('envelope must be frozen and locked');
  }
}
