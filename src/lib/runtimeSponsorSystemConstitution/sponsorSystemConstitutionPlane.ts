/**
 * Phase 1.9.31 — Sponsor System Constitution Plane.
 * Top-level orchestrator. Produces a deterministic, formal constitution of the
 * sponsor architecture (1.9.14 → 1.9.30) plus governing certification envelope.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorConstitutionDeterminismError } from './sponsorConstitutionInternals';
import {
  generateConstitutionalAxioms,
  type SponsorConstitutionalAxiomsRegistry,
} from './sponsorConstitutionalAxioms';
import {
  buildSupremeInvariantRegistry,
  type SponsorSupremeInvariantRegistry,
} from './sponsorSupremeInvariantRegistry';
import {
  generateLayerDescriptors,
  resolveConstitutionGraph,
  type SponsorConstitutionGraph,
  type SponsorConstitutionLayerInput,
} from './sponsorConstitutionGraph';
import {
  computeConstitutionLineage,
  type SponsorConstitutionLineage,
} from './sponsorConstitutionLineage';
import {
  generateConstitutionSnapshot,
  type SponsorDeterministicConstitutionSnapshot,
} from './sponsorConstitutionSnapshot';
import {
  buildSystemConstitution,
  buildConstitutionCertificationEnvelope,
  lockConstitutionEnvelope,
  type SponsorSystemConstitution,
  type SponsorConstitutionCertificationEnvelope,
} from './sponsorConstitutionCertificationEnvelope';

export interface SponsorSystemConstitutionResult {
  readonly axioms: SponsorConstitutionalAxiomsRegistry;
  readonly invariants: SponsorSupremeInvariantRegistry;
  readonly graph: SponsorConstitutionGraph;
  readonly constitution: SponsorSystemConstitution;
  readonly lineage: SponsorConstitutionLineage;
  readonly snapshot: SponsorDeterministicConstitutionSnapshot;
  readonly envelope: SponsorConstitutionCertificationEnvelope;
}

export function runSystemConstitutionPlane(
  inputs: ReadonlyArray<SponsorConstitutionLayerInput> = [],
): SponsorSystemConstitutionResult {
  const axioms = generateConstitutionalAxioms();
  const invariants = buildSupremeInvariantRegistry();
  const descriptors = generateLayerDescriptors(inputs);
  const graph = resolveConstitutionGraph(axioms, invariants, descriptors);
  const constitution = buildSystemConstitution(axioms, invariants, graph);
  const lineage = computeConstitutionLineage(descriptors);
  const snapshot = generateConstitutionSnapshot(axioms, invariants, graph, lineage);
  const envelope = buildConstitutionCertificationEnvelope(
    axioms,
    invariants,
    graph,
    constitution,
    lineage,
    snapshot,
  );
  lockConstitutionEnvelope(envelope);
  return Object.freeze({
    axioms,
    invariants,
    graph,
    constitution,
    lineage,
    snapshot,
    envelope,
  });
}

export function assertConstitutionDeterminism(
  a: SponsorConstitutionCertificationEnvelope,
  b: SponsorConstitutionCertificationEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorConstitutionDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.axioms.axiomsSignature !== b.axioms.axiomsSignature) {
    throw new SponsorConstitutionDeterminismError('axioms signature drift');
  }
  if (a.invariants.invariantsSignature !== b.invariants.invariantsSignature) {
    throw new SponsorConstitutionDeterminismError('invariants signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorConstitutionDeterminismError('graph signature drift');
  }
  if (a.constitution.constitutionSignature !== b.constitution.constitutionSignature) {
    throw new SponsorConstitutionDeterminismError('constitution signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorConstitutionDeterminismError('lineage signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorConstitutionDeterminismError('snapshot signature drift');
  }
}
