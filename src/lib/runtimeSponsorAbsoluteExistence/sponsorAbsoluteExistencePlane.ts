/**
 * Phase 1.9.34 — Sponsor Absolute Existence Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorExistenceDeterminismError } from './sponsorExistenceInternals';
import {
  generateExistenceIdentity,
  type SponsorAbsoluteIdentity,
  type SponsorAbsoluteIdentityInput,
} from './sponsorAbsoluteIdentity';
import {
  buildExistenceInvariants,
  type SponsorExistenceInvariantRegistry,
} from './sponsorExistenceInvariants';
import { resolveOntologyGraph, type SponsorOntologyGraph } from './sponsorOntologyGraph';
import { computeOntologyLineage, type SponsorOntologyLineage } from './sponsorOntologyLineage';
import {
  generateExistenceSnapshot,
  type SponsorDeterministicExistenceSnapshot,
} from './sponsorExistenceSnapshot';
import {
  buildExistenceCertificationEnvelope,
  lockExistenceEnvelope,
  type SponsorExistenceCertificationEnvelope,
} from './sponsorExistenceCertificationEnvelope';

export interface SponsorAbsoluteExistenceResult {
  readonly identity: SponsorAbsoluteIdentity;
  readonly invariants: SponsorExistenceInvariantRegistry;
  readonly graph: SponsorOntologyGraph;
  readonly lineage: SponsorOntologyLineage;
  readonly snapshot: SponsorDeterministicExistenceSnapshot;
  readonly envelope: SponsorExistenceCertificationEnvelope;
}

export function buildAbsoluteExistence(
  inputs: ReadonlyArray<SponsorAbsoluteIdentityInput> = [],
): SponsorAbsoluteExistenceResult {
  const identity = generateExistenceIdentity(inputs);
  const invariants = buildExistenceInvariants(identity);
  const graph = resolveOntologyGraph(identity, invariants);
  const lineage = computeOntologyLineage(identity);
  const snapshot = generateExistenceSnapshot(identity, invariants, graph, lineage);
  const envelope = buildExistenceCertificationEnvelope(
    identity,
    invariants,
    graph,
    lineage,
    snapshot,
  );
  lockExistenceEnvelope(envelope);
  return Object.freeze({ identity, invariants, graph, lineage, snapshot, envelope });
}

export function assertExistenceDeterminism(
  a: SponsorExistenceCertificationEnvelope,
  b: SponsorExistenceCertificationEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorExistenceDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.identity.absoluteIdentity !== b.identity.absoluteIdentity) {
    throw new SponsorExistenceDeterminismError('absolute identity drift');
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorExistenceDeterminismError('invariants signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorExistenceDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorExistenceDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorExistenceDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorExistenceDeterminismError('snapshot signature drift');
  }
}
