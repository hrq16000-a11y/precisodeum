/**
 * Phase 1.9.38 — Sponsor Absolute Reflexivity Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorReflexivityDeterminismError } from './sponsorReflexivityInternals';
import {
  generateReflexivityInvariants,
  type SponsorReflexivityInvariantRegistry,
} from './sponsorReflexivityInvariants';
import {
  buildRecursiveCompletenessProofs,
  generateReflexivityLayerDescriptors,
  type SponsorReflexivityLayerInput,
  type SponsorRecursiveCompletenessProofs,
} from './sponsorRecursiveCompletenessProofs';
import {
  resolveReflexivityGraph,
  type SponsorReflexivityGraph,
} from './sponsorReflexivityGraph';
import {
  computeReflexiveLineage,
  type SponsorReflexivityLineage,
} from './sponsorReflexiveLineage';
import {
  generateReflexivitySnapshot,
  type SponsorDeterministicReflexivitySnapshot,
} from './sponsorReflexivitySnapshot';
import {
  buildAbsoluteReflexivityEnvelope,
  lockReflexivityEnvelope,
  type SponsorAbsoluteReflexivityEnvelope,
} from './sponsorAbsoluteReflexivityEnvelope';

export interface SponsorAbsoluteReflexivityResult {
  readonly invariants: SponsorReflexivityInvariantRegistry;
  readonly proofs: SponsorRecursiveCompletenessProofs;
  readonly graph: SponsorReflexivityGraph;
  readonly lineage: SponsorReflexivityLineage;
  readonly snapshot: SponsorDeterministicReflexivitySnapshot;
  readonly envelope: SponsorAbsoluteReflexivityEnvelope;
}

export function buildAbsoluteReflexivity(
  inputs: ReadonlyArray<SponsorReflexivityLayerInput> = [],
): SponsorAbsoluteReflexivityResult {
  const invariants = generateReflexivityInvariants();
  const descriptors = generateReflexivityLayerDescriptors(inputs);
  const proofs = buildRecursiveCompletenessProofs(invariants, descriptors);
  const graph = resolveReflexivityGraph(invariants, proofs);
  const lineage = computeReflexiveLineage(descriptors);
  const snapshot = generateReflexivitySnapshot(invariants, proofs, graph, lineage);
  const envelope = buildAbsoluteReflexivityEnvelope(
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
  );
  lockReflexivityEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertReflexivityDeterminism(
  a: SponsorAbsoluteReflexivityEnvelope,
  b: SponsorAbsoluteReflexivityEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorReflexivityDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorReflexivityDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorReflexivityDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorReflexivityDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorReflexivityDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorReflexivityDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorReflexivityDeterminismError('snapshot signature drift');
  }
}
