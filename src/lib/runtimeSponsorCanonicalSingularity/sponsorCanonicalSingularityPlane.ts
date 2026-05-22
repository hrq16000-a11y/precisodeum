/**
 * Phase 1.9.41 — Sponsor Canonical Singularity Plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorSingularityDeterminismError } from './sponsorSingularityInternals';
import {
  generateSingularityInvariants,
  type SponsorSingularityInvariantRegistry,
} from './sponsorSingularityInvariants';
import {
  buildCanonicalCollapseProofs,
  generateSingularityLayerDescriptors,
  type SponsorSingularityLayerInput,
  type SponsorCanonicalCollapseProofs,
} from './sponsorCanonicalCollapseProofs';
import {
  resolveSingularityGraph,
  type SponsorSingularityGraph,
} from './sponsorSingularityGraph';
import {
  computeSingularityLineage,
  type SponsorSingularityLineage,
} from './sponsorSingularityLineage';
import {
  generateSingularitySnapshot,
  type SponsorDeterministicSingularitySnapshot,
} from './sponsorSingularitySnapshot';
import {
  buildCanonicalSingularityEnvelope,
  lockSingularityEnvelope,
  type SponsorCanonicalSingularityEnvelope,
} from './sponsorCanonicalSingularityEnvelope';

export interface SponsorCanonicalSingularityResult {
  readonly invariants: SponsorSingularityInvariantRegistry;
  readonly proofs: SponsorCanonicalCollapseProofs;
  readonly graph: SponsorSingularityGraph;
  readonly lineage: SponsorSingularityLineage;
  readonly snapshot: SponsorDeterministicSingularitySnapshot;
  readonly envelope: SponsorCanonicalSingularityEnvelope;
}

export function buildCanonicalSingularity(
  inputs: ReadonlyArray<SponsorSingularityLayerInput> = [],
): SponsorCanonicalSingularityResult {
  const invariants = generateSingularityInvariants();
  const descriptors = generateSingularityLayerDescriptors(inputs);
  const proofs = buildCanonicalCollapseProofs(invariants, descriptors);
  const graph = resolveSingularityGraph(invariants, proofs);
  const lineage = computeSingularityLineage(descriptors);
  const snapshot = generateSingularitySnapshot(invariants, proofs, graph, lineage);
  const envelope = buildCanonicalSingularityEnvelope(
    invariants,
    proofs,
    graph,
    lineage,
    snapshot,
  );
  lockSingularityEnvelope(envelope);
  return Object.freeze({ invariants, proofs, graph, lineage, snapshot, envelope });
}

export function assertSingularityDeterminism(
  a: SponsorCanonicalSingularityEnvelope,
  b: SponsorCanonicalSingularityEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorSingularityDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorSingularityDeterminismError('invariants signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorSingularityDeterminismError('proofs signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorSingularityDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorSingularityDeterminismError('lineage signature drift');
  }
  if (a.lineage.singularitySignature !== b.lineage.singularitySignature) {
    throw new SponsorSingularityDeterminismError('singularity signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorSingularityDeterminismError('snapshot signature drift');
  }
}
