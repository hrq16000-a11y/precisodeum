/**
 * Phase 1.9.40 — Sponsor Omega Terminal Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorOmegaDeterminismError } from './sponsorOmegaInternals';
import {
  generateOmegaInvariants,
  type SponsorOmegaInvariantRegistry,
} from './sponsorOmegaInvariants';
import {
  buildIrreducibleCompletenessProofs,
  generateOmegaLayerDescriptors,
  type SponsorOmegaLayerInput,
  type SponsorIrreducibleCompletenessProofs,
} from './sponsorIrreducibleCompletenessProofs';
import { resolveOmegaGraph, type SponsorOmegaGraph } from './sponsorOmegaGraph';
import { computeOmegaLineage, type SponsorOmegaLineage } from './sponsorOmegaLineage';
import {
  generateOmegaSnapshot,
  type SponsorDeterministicOmegaSnapshot,
} from './sponsorOmegaSnapshot';
import {
  buildOmegaTerminalEnvelope,
  lockOmegaEnvelope,
  type SponsorOmegaTerminalEnvelope,
} from './sponsorOmegaTerminalEnvelope';

export interface SponsorOmegaTerminalResult {
  readonly invariants: SponsorOmegaInvariantRegistry;
  readonly proofs: SponsorIrreducibleCompletenessProofs;
  readonly graph: SponsorOmegaGraph;
  readonly lineage: SponsorOmegaLineage;
  readonly snapshot: SponsorDeterministicOmegaSnapshot;
  readonly envelope: SponsorOmegaTerminalEnvelope;
}

export function buildOmegaTerminalState(
  inputs: ReadonlyArray<SponsorOmegaLayerInput> = [],
): SponsorOmegaTerminalResult {
  const invariants = generateOmegaInvariants();
  const descriptors = generateOmegaLayerDescriptors(inputs);
  const proofs = buildIrreducibleCompletenessProofs(invariants, descriptors);
  const graph = resolveOmegaGraph(invariants, proofs);
  const lineage = computeOmegaLineage(descriptors);
  const snapshot = generateOmegaSnapshot(invariants, proofs, graph, lineage);
  const envelope = buildOmegaTerminalEnvelope(invariants, proofs, graph, lineage, snapshot);
  lockOmegaEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertOmegaDeterminism(
  a: SponsorOmegaTerminalEnvelope,
  b: SponsorOmegaTerminalEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorOmegaDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorOmegaDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorOmegaDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorOmegaDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorOmegaDeterminismError('lineage signature drift');
  }
  if (a.lineage.terminalSignature !== b.lineage.terminalSignature) {
    throw new SponsorOmegaDeterminismError('terminal signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorOmegaDeterminismError('snapshot signature drift');
  }
}
