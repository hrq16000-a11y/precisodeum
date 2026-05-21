/**
 * Phase 1.9.33 — Sponsor Terminal Fixed-Point Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorFixedPointDeterminismError } from './sponsorFixedPointInternals';
import {
  generateFixedPointConsensus,
  type SponsorFixedPointConsensusRegistry,
} from './sponsorFixedPointConsensus';
import {
  buildTerminalImmutabilityProofs,
  generateLayerDescriptors,
  type SponsorFixedPointLayerInput,
  type SponsorTerminalImmutabilityProofs,
} from './sponsorTerminalImmutabilityProofs';
import {
  resolveFixedPointGraph,
  type SponsorFixedPointGraph,
} from './sponsorFixedPointGraph';
import {
  computeFixedPointLineage,
  type SponsorFixedPointLineage,
} from './sponsorFixedPointLineage';
import {
  generateFixedPointSnapshot,
  type SponsorDeterministicFixedPointSnapshot,
} from './sponsorFixedPointSnapshot';
import {
  buildTerminalConsensusEnvelope,
  lockFixedPointEnvelope,
  type SponsorTerminalConsensusEnvelope,
} from './sponsorTerminalConsensusEnvelope';

export interface SponsorTerminalFixedPointResult {
  readonly consensus: SponsorFixedPointConsensusRegistry;
  readonly proofs: SponsorTerminalImmutabilityProofs;
  readonly graph: SponsorFixedPointGraph;
  readonly lineage: SponsorFixedPointLineage;
  readonly snapshot: SponsorDeterministicFixedPointSnapshot;
  readonly envelope: SponsorTerminalConsensusEnvelope;
}

export function buildTerminalFixedPoint(
  inputs: ReadonlyArray<SponsorFixedPointLayerInput> = [],
): SponsorTerminalFixedPointResult {
  const consensus = generateFixedPointConsensus();
  const descriptors = generateLayerDescriptors(inputs);
  const proofs = buildTerminalImmutabilityProofs(consensus, descriptors);
  const graph = resolveFixedPointGraph(consensus, proofs);
  const lineage = computeFixedPointLineage(descriptors);
  const snapshot = generateFixedPointSnapshot(consensus, proofs, graph, lineage);
  const envelope = buildTerminalConsensusEnvelope(consensus, proofs, graph, lineage, snapshot);
  lockFixedPointEnvelope(envelope);
  return Object.freeze({ consensus, proofs, graph, lineage, snapshot, envelope });
}

export function assertFixedPointDeterminism(
  a: SponsorTerminalConsensusEnvelope,
  b: SponsorTerminalConsensusEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorFixedPointDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.consensus.consensusSignature !== b.consensus.consensusSignature) {
    throw new SponsorFixedPointDeterminismError('consensus signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorFixedPointDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorFixedPointDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorFixedPointDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorFixedPointDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorFixedPointDeterminismError('snapshot signature drift');
  }
}
