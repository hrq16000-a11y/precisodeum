/**
 * Phase 1.9.44 — Sponsor Recursive Infinity Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorInfinityDeterminismError } from './sponsorInfinityInternals';
import {
  generateInfinityInvariants,
  type SponsorInfinityInvariantRegistry,
} from './sponsorInfinityInvariants';
import {
  buildRecursiveContainmentProofs,
  generateInfinityLayerDescriptors,
  type SponsorInfinityLayerInput,
  type SponsorRecursiveContainmentProofs,
} from './sponsorRecursiveContainmentProofs';
import {
  resolveRecursiveInfinityGraph,
  type SponsorRecursiveInfinityGraph,
} from './sponsorRecursiveInfinityGraph';
import {
  computeInfinityLineage,
  type SponsorInfinityLineage,
} from './sponsorInfinityLineage';
import {
  generateInfinitySnapshot,
  type SponsorDeterministicInfinitySnapshot,
} from './sponsorInfinitySnapshot';
import {
  buildInfinityEnvelope,
  lockInfinityEnvelope,
  type SponsorInfinityEnvelope,
} from './sponsorInfinityEnvelope';

export interface SponsorRecursiveInfinityResult {
  readonly invariants: SponsorInfinityInvariantRegistry;
  readonly proofs: SponsorRecursiveContainmentProofs;
  readonly graph: SponsorRecursiveInfinityGraph;
  readonly lineage: SponsorInfinityLineage;
  readonly snapshot: SponsorDeterministicInfinitySnapshot;
  readonly envelope: SponsorInfinityEnvelope;
}

export function buildRecursiveInfinityState(
  inputs: ReadonlyArray<SponsorInfinityLayerInput> = [],
): SponsorRecursiveInfinityResult {
  const invariants = generateInfinityInvariants();
  const descriptors = generateInfinityLayerDescriptors(inputs);
  const proofs = buildRecursiveContainmentProofs(invariants, descriptors);
  const graph = resolveRecursiveInfinityGraph(invariants, proofs);
  const lineage = computeInfinityLineage(descriptors);
  const snapshot = generateInfinitySnapshot(invariants, proofs, graph, lineage);
  const envelope = buildInfinityEnvelope(invariants, proofs, graph, lineage, snapshot);
  lockInfinityEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertInfinityDeterminism(
  a: SponsorInfinityEnvelope,
  b: SponsorInfinityEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorInfinityDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorInfinityDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorInfinityDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorInfinityDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorInfinityDeterminismError('lineage signature drift');
  }
  if (a.lineage.infinitySignature !== b.lineage.infinitySignature) {
    throw new SponsorInfinityDeterminismError('infinity signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorInfinityDeterminismError('snapshot signature drift');
  }
}
