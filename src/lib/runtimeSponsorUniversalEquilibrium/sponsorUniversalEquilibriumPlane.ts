/**
 * Phase 1.9.36 — Sponsor Universal Equilibrium Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorEquilibriumDeterminismError } from './sponsorEquilibriumInternals';
import {
  generateEquilibriumInvariants,
  type SponsorEquilibriumInvariantRegistry,
} from './sponsorEquilibriumInvariants';
import {
  buildUniversalSaturationProofs,
  generateLayerDescriptors,
  type SponsorEquilibriumLayerInput,
  type SponsorUniversalSaturationProofs,
} from './sponsorUniversalSaturationProofs';
import {
  resolveEquilibriumGraph,
  type SponsorEquilibriumGraph,
} from './sponsorEquilibriumGraph';
import {
  computeSaturationLineage,
  type SponsorSaturationLineage,
} from './sponsorSaturationLineage';
import {
  generateEquilibriumSnapshot,
  type SponsorDeterministicEquilibriumSnapshot,
} from './sponsorEquilibriumSnapshot';
import {
  buildTerminalEquilibriumEnvelope,
  lockEquilibriumEnvelope,
  type SponsorTerminalEquilibriumEnvelope,
} from './sponsorTerminalEquilibriumEnvelope';

export interface SponsorUniversalEquilibriumResult {
  readonly invariants: SponsorEquilibriumInvariantRegistry;
  readonly proofs: SponsorUniversalSaturationProofs;
  readonly graph: SponsorEquilibriumGraph;
  readonly lineage: SponsorSaturationLineage;
  readonly snapshot: SponsorDeterministicEquilibriumSnapshot;
  readonly envelope: SponsorTerminalEquilibriumEnvelope;
}

export function buildUniversalEquilibrium(
  inputs: ReadonlyArray<SponsorEquilibriumLayerInput> = [],
): SponsorUniversalEquilibriumResult {
  const invariants = generateEquilibriumInvariants();
  const descriptors = generateLayerDescriptors(inputs);
  const proofs = buildUniversalSaturationProofs(invariants, descriptors);
  const graph = resolveEquilibriumGraph(invariants, proofs);
  const lineage = computeSaturationLineage(descriptors);
  const snapshot = generateEquilibriumSnapshot(invariants, proofs, graph, lineage);
  const envelope = buildTerminalEquilibriumEnvelope(
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
  );
  lockEquilibriumEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertEquilibriumDeterminism(
  a: SponsorTerminalEquilibriumEnvelope,
  b: SponsorTerminalEquilibriumEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorEquilibriumDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorEquilibriumDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorEquilibriumDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorEquilibriumDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorEquilibriumDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorEquilibriumDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorEquilibriumDeterminismError('snapshot signature drift');
  }
}
