/**
 * Phase 1.9.42 — Sponsor Eternal Canonical Invariance Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorEternalDeterminismError } from './sponsorEternalInternals';
import {
  generateEternalInvariants,
  type SponsorEternalInvariantRegistry,
} from './sponsorEternalInvariants';
import {
  buildPermanentStabilityProofs,
  generateEternalLayerDescriptors,
  type SponsorEternalLayerInput,
  type SponsorPermanentStabilityProofs,
} from './sponsorPermanentStabilityProofs';
import {
  resolvePermanentInvarianceGraph,
  type SponsorPermanentInvarianceGraph,
} from './sponsorPermanentInvarianceGraph';
import {
  computeEternalLineage,
  type SponsorEternalLineage,
} from './sponsorEternalLineage';
import {
  generateEternalSnapshot,
  type SponsorDeterministicEternalSnapshot,
} from './sponsorEternalSnapshot';
import {
  buildEternalCanonicalEnvelope,
  lockEternalEnvelope,
  type SponsorEternalCanonicalEnvelope,
} from './sponsorEternalCanonicalEnvelope';

export interface SponsorEternalCanonicalResult {
  readonly invariants: SponsorEternalInvariantRegistry;
  readonly proofs: SponsorPermanentStabilityProofs;
  readonly graph: SponsorPermanentInvarianceGraph;
  readonly lineage: SponsorEternalLineage;
  readonly snapshot: SponsorDeterministicEternalSnapshot;
  readonly envelope: SponsorEternalCanonicalEnvelope;
}

export function buildEternalCanonicalState(
  inputs: ReadonlyArray<SponsorEternalLayerInput> = [],
): SponsorEternalCanonicalResult {
  const invariants = generateEternalInvariants();
  const descriptors = generateEternalLayerDescriptors(inputs);
  const proofs = buildPermanentStabilityProofs(invariants, descriptors);
  const graph = resolvePermanentInvarianceGraph(invariants, proofs);
  const lineage = computeEternalLineage(descriptors);
  const snapshot = generateEternalSnapshot(invariants, proofs, graph, lineage);
  const envelope = buildEternalCanonicalEnvelope(
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
  );
  lockEternalEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertEternalDeterminism(
  a: SponsorEternalCanonicalEnvelope,
  b: SponsorEternalCanonicalEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorEternalDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorEternalDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorEternalDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorEternalDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorEternalDeterminismError('lineage signature drift');
  }
  if (a.lineage.eternalSignature !== b.lineage.eternalSignature) {
    throw new SponsorEternalDeterminismError('eternal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorEternalDeterminismError('snapshot signature drift');
  }
}
