/**
 * Phase 1.9.34 — Sponsor Existence Certification Envelope.
 */
import {
  SPONSOR_EXISTENCE_INTERNALS,
  SponsorExistenceMutationError,
  deepFreeze,
  signObject,
} from './sponsorExistenceInternals';
import type { SponsorAbsoluteIdentity } from './sponsorAbsoluteIdentity';
import type { SponsorExistenceInvariantRegistry } from './sponsorExistenceInvariants';
import type { SponsorOntologyGraph } from './sponsorOntologyGraph';
import type { SponsorOntologyLineage } from './sponsorOntologyLineage';
import type { SponsorDeterministicExistenceSnapshot } from './sponsorExistenceSnapshot';

export interface SponsorExistenceCertificationEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly identity: SponsorAbsoluteIdentity;
  readonly invariants: SponsorExistenceInvariantRegistry;
  readonly graph: SponsorOntologyGraph;
  readonly lineage: SponsorOntologyLineage;
  readonly snapshot: SponsorDeterministicExistenceSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildExistenceCertificationEnvelope(
  identity: SponsorAbsoluteIdentity,
  invariants: SponsorExistenceInvariantRegistry,
  graph: SponsorOntologyGraph,
  lineage: SponsorOntologyLineage,
  snapshot: SponsorDeterministicExistenceSnapshot,
): SponsorExistenceCertificationEnvelope {
  const envelopeSignature = signObject({
    identity: identity.absoluteIdentity,
    invariants: invariants.invariantsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_EXISTENCE_INTERNALS.stage,
    identity,
    invariants,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockExistenceEnvelope(env: SponsorExistenceCertificationEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorExistenceMutationError('envelope must be frozen and locked');
  }
}
