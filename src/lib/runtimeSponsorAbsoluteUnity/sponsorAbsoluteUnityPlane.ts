/**
 * Phase 1.9.37 — Sponsor Absolute Unity Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorUnityDeterminismError } from './sponsorUnityInternals';
import {
  generateUnityInvariants,
  type SponsorUnityInvariantRegistry,
} from './sponsorUnityInvariants';
import {
  buildSelfEquivalenceProofs,
  generateUnityLayerDescriptors,
  type SponsorUnityLayerInput,
  type SponsorSelfEquivalenceProofs,
} from './sponsorSelfEquivalenceProofs';
import { resolveUnityGraph, type SponsorUnityGraph } from './sponsorUnityGraph';
import { computeUnityLineage, type SponsorUnityLineage } from './sponsorUnityLineage';
import {
  generateUnitySnapshot,
  type SponsorDeterministicUnitySnapshot,
} from './sponsorUnitySnapshot';
import {
  buildAbsoluteUnityEnvelope,
  lockUnityEnvelope,
  type SponsorAbsoluteUnityEnvelope,
} from './sponsorAbsoluteUnityEnvelope';

export interface SponsorAbsoluteUnityResult {
  readonly invariants: SponsorUnityInvariantRegistry;
  readonly proofs: SponsorSelfEquivalenceProofs;
  readonly graph: SponsorUnityGraph;
  readonly lineage: SponsorUnityLineage;
  readonly snapshot: SponsorDeterministicUnitySnapshot;
  readonly envelope: SponsorAbsoluteUnityEnvelope;
}

export function buildAbsoluteUnity(
  inputs: ReadonlyArray<SponsorUnityLayerInput> = [],
): SponsorAbsoluteUnityResult {
  const invariants = generateUnityInvariants();
  const descriptors = generateUnityLayerDescriptors(inputs);
  const proofs = buildSelfEquivalenceProofs(invariants, descriptors);
  const graph = resolveUnityGraph(invariants, proofs);
  const lineage = computeUnityLineage(descriptors);
  const snapshot = generateUnitySnapshot(invariants, proofs, graph, lineage);
  const envelope = buildAbsoluteUnityEnvelope(invariants, proofs, graph, lineage, snapshot);
  lockUnityEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertUnityDeterminism(
  a: SponsorAbsoluteUnityEnvelope,
  b: SponsorAbsoluteUnityEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorUnityDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorUnityDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorUnityDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorUnityDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorUnityDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorUnityDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorUnityDeterminismError('snapshot signature drift');
  }
}
