/**
 * Phase 1.9.32 — Sponsor Meta-Consistency Closure Plane.
 * Top-level orchestrator. Produces deterministic terminal closure over
 * layers 1.9.14 → 1.9.31.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorClosureDeterminismError } from './sponsorClosureInternals';
import {
  generateConsistencyTheorems,
  type SponsorConsistencyTheoremRegistry,
} from './sponsorConsistencyTheorems';
import {
  buildTerminalConsistencyProofs,
  generateLayerDescriptors,
  type SponsorClosureLayerInput,
  type SponsorTerminalConsistencyProofs,
} from './sponsorTerminalConsistencyProofs';
import {
  resolveClosureTheoremGraph,
  type SponsorClosureTheoremGraph,
} from './sponsorClosureTheoremGraph';
import { computeClosureLineage, type SponsorClosureLineage } from './sponsorClosureLineage';
import {
  generateClosureSnapshot,
  type SponsorDeterministicClosureSnapshot,
} from './sponsorClosureSnapshot';
import {
  buildAbsoluteClosureEnvelope,
  lockClosureEnvelope,
  type SponsorAbsoluteClosureEnvelope,
} from './sponsorAbsoluteClosureEnvelope';

export interface SponsorMetaConsistencyClosureResult {
  readonly theorems: SponsorConsistencyTheoremRegistry;
  readonly proofs: SponsorTerminalConsistencyProofs;
  readonly graph: SponsorClosureTheoremGraph;
  readonly lineage: SponsorClosureLineage;
  readonly snapshot: SponsorDeterministicClosureSnapshot;
  readonly envelope: SponsorAbsoluteClosureEnvelope;
}

export function buildMetaConsistencyClosure(
  inputs: ReadonlyArray<SponsorClosureLayerInput> = [],
): SponsorMetaConsistencyClosureResult {
  const theorems = generateConsistencyTheorems();
  const descriptors = generateLayerDescriptors(inputs);
  const proofs = buildTerminalConsistencyProofs(theorems, descriptors);
  const graph = resolveClosureTheoremGraph(theorems, proofs);
  const lineage = computeClosureLineage(descriptors);
  const snapshot = generateClosureSnapshot(theorems, proofs, graph, lineage);
  const envelope = buildAbsoluteClosureEnvelope(theorems, proofs, graph, lineage, snapshot);
  lockClosureEnvelope(envelope);
  return Object.freeze({ theorems, proofs, graph, lineage, snapshot, envelope });
}

export function assertClosureDeterminism(
  a: SponsorAbsoluteClosureEnvelope,
  b: SponsorAbsoluteClosureEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorClosureDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.theorems.theoremsSignature !== b.theorems.theoremsSignature) {
    throw new SponsorClosureDeterminismError('theorems signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorClosureDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorClosureDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorClosureDeterminismError('lineage signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorClosureDeterminismError('snapshot signature drift');
  }
}
