/**
 * Phase 1.9.39 — Sponsor Absolute Closure-Unity Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorClosureUnityDeterminismError } from './sponsorClosureUnityInternals';
import {
  generateClosureUnityInvariants,
  type SponsorClosureUnityInvariantRegistry,
} from './sponsorClosureUnityInvariants';
import {
  buildSelfContainmentProofs,
  generateClosureUnityLayerDescriptors,
  type SponsorClosureUnityLayerInput,
  type SponsorSelfContainmentProofs,
} from './sponsorSelfContainmentProofs';
import {
  resolveClosureUnityGraph,
  type SponsorClosureUnityGraph,
} from './sponsorClosureUnityGraph';
import {
  computeClosureUnityLineage,
  type SponsorClosureUnityLineage,
} from './sponsorClosureUnityLineage';
import {
  generateClosureUnitySnapshot,
  type SponsorDeterministicClosureUnitySnapshot,
} from './sponsorClosureUnitySnapshot';
import {
  buildAbsoluteClosureUnityEnvelope,
  lockClosureUnityEnvelope,
  type SponsorAbsoluteClosureUnityEnvelope,
} from './sponsorAbsoluteClosureUnityEnvelope';

export interface SponsorAbsoluteClosureUnityResult {
  readonly invariants: SponsorClosureUnityInvariantRegistry;
  readonly proofs: SponsorSelfContainmentProofs;
  readonly graph: SponsorClosureUnityGraph;
  readonly lineage: SponsorClosureUnityLineage;
  readonly snapshot: SponsorDeterministicClosureUnitySnapshot;
  readonly envelope: SponsorAbsoluteClosureUnityEnvelope;
}

export function buildAbsoluteClosureUnity(
  inputs: ReadonlyArray<SponsorClosureUnityLayerInput> = [],
): SponsorAbsoluteClosureUnityResult {
  const invariants = generateClosureUnityInvariants();
  const descriptors = generateClosureUnityLayerDescriptors(inputs);
  const proofs = buildSelfContainmentProofs(invariants, descriptors);
  const graph = resolveClosureUnityGraph(invariants, proofs);
  const lineage = computeClosureUnityLineage(descriptors);
  const snapshot = generateClosureUnitySnapshot(invariants, proofs, graph, lineage);
  const envelope = buildAbsoluteClosureUnityEnvelope(
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
  );
  lockClosureUnityEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertClosureUnityDeterminism(
  a: SponsorAbsoluteClosureUnityEnvelope,
  b: SponsorAbsoluteClosureUnityEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorClosureUnityDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorClosureUnityDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorClosureUnityDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorClosureUnityDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorClosureUnityDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorClosureUnityDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorClosureUnityDeterminismError('snapshot signature drift');
  }
}
