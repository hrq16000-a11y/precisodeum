/**
 * Phase 1.9.35 — Sponsor Terminal Coherence Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorCoherenceDeterminismError } from './sponsorCoherenceInternals';
import {
  generateCoherenceInvariants,
  type SponsorCoherenceInvariantRegistry,
} from './sponsorCoherenceInvariants';
import {
  buildOntologicalCompletenessProofs,
  generateLayerDescriptors,
  type SponsorCoherenceLayerInput,
  type SponsorOntologicalCompletenessProofs,
} from './sponsorOntologicalCompletenessProofs';
import {
  resolveCompletenessGraph,
  type SponsorCompletenessGraph,
} from './sponsorCompletenessGraph';
import {
  computeCompletenessLineage,
  type SponsorCompletenessLineage,
} from './sponsorCompletenessLineage';
import {
  generateCoherenceSnapshot,
  type SponsorDeterministicCoherenceSnapshot,
} from './sponsorCoherenceSnapshot';
import {
  buildTerminalCoherenceEnvelope,
  lockCoherenceEnvelope,
  type SponsorTerminalCoherenceEnvelope,
} from './sponsorTerminalCoherenceEnvelope';

export interface SponsorTerminalCoherenceResult {
  readonly invariants: SponsorCoherenceInvariantRegistry;
  readonly proofs: SponsorOntologicalCompletenessProofs;
  readonly graph: SponsorCompletenessGraph;
  readonly lineage: SponsorCompletenessLineage;
  readonly snapshot: SponsorDeterministicCoherenceSnapshot;
  readonly envelope: SponsorTerminalCoherenceEnvelope;
}

export function buildTerminalCoherence(
  inputs: ReadonlyArray<SponsorCoherenceLayerInput> = [],
): SponsorTerminalCoherenceResult {
  const invariants = generateCoherenceInvariants();
  const descriptors = generateLayerDescriptors(inputs);
  const proofs = buildOntologicalCompletenessProofs(invariants, descriptors);
  const graph = resolveCompletenessGraph(invariants, proofs);
  const lineage = computeCompletenessLineage(descriptors);
  const snapshot = generateCoherenceSnapshot(invariants, proofs, graph, lineage);
  const envelope = buildTerminalCoherenceEnvelope(invariants, proofs, graph, lineage, snapshot);
  lockCoherenceEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertCoherenceDeterminism(
  a: SponsorTerminalCoherenceEnvelope,
  b: SponsorTerminalCoherenceEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorCoherenceDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorCoherenceDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorCoherenceDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorCoherenceDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorCoherenceDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorCoherenceDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorCoherenceDeterminismError('snapshot signature drift');
  }
}
