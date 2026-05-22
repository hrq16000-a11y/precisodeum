/**
 * Phase 1.9.43 — Sponsor Transcendent Meta-Identity Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorTranscendentDeterminismError } from './sponsorTranscendentInternals';
import {
  generateTranscendentInvariants,
  type SponsorTranscendentInvariantRegistry,
} from './sponsorTranscendentInvariants';
import {
  buildUniversalSelfEquivalenceProofs,
  generateTranscendentLayerDescriptors,
  type SponsorTranscendentLayerInput,
  type SponsorUniversalSelfEquivalenceProofs,
} from './sponsorUniversalSelfEquivalenceProofs';
import {
  resolveTranscendentIdentityGraph,
  type SponsorTranscendentIdentityGraph,
} from './sponsorTranscendentIdentityGraph';
import {
  computeTranscendentLineage,
  type SponsorTranscendentLineage,
} from './sponsorTranscendentLineage';
import {
  generateTranscendentSnapshot,
  type SponsorDeterministicTranscendentSnapshot,
} from './sponsorTranscendentSnapshot';
import {
  buildTranscendentEnvelope,
  lockTranscendentEnvelope,
  type SponsorTranscendentEnvelope,
} from './sponsorTranscendentEnvelope';

export interface SponsorTranscendentIdentityResult {
  readonly invariants: SponsorTranscendentInvariantRegistry;
  readonly proofs: SponsorUniversalSelfEquivalenceProofs;
  readonly graph: SponsorTranscendentIdentityGraph;
  readonly lineage: SponsorTranscendentLineage;
  readonly snapshot: SponsorDeterministicTranscendentSnapshot;
  readonly envelope: SponsorTranscendentEnvelope;
}

export function buildTranscendentIdentityState(
  inputs: ReadonlyArray<SponsorTranscendentLayerInput> = [],
): SponsorTranscendentIdentityResult {
  const invariants = generateTranscendentInvariants();
  const descriptors = generateTranscendentLayerDescriptors(inputs);
  const proofs = buildUniversalSelfEquivalenceProofs(invariants, descriptors);
  const graph = resolveTranscendentIdentityGraph(invariants, proofs);
  const lineage = computeTranscendentLineage(descriptors);
  const snapshot = generateTranscendentSnapshot(invariants, proofs, graph, lineage);
  const envelope = buildTranscendentEnvelope(
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
  );
  lockTranscendentEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertTranscendentDeterminism(
  a: SponsorTranscendentEnvelope,
  b: SponsorTranscendentEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorTranscendentDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorTranscendentDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorTranscendentDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorTranscendentDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorTranscendentDeterminismError('lineage signature drift');
  }
  if (a.lineage.transcendentSignature !== b.lineage.transcendentSignature) {
    throw new SponsorTranscendentDeterminismError('transcendent signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorTranscendentDeterminismError('snapshot signature drift');
  }
}
