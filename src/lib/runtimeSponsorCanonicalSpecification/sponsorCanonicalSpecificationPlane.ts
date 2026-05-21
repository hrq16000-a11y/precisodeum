/**
 * Phase 1.9.30 — Sponsor Canonical Specification Plane.
 * Top-level orchestrator. Produces a deterministic, formal specification of the
 * sponsor architecture (1.9.14 → 1.9.29) plus certification envelope.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorSpecificationDeterminismError } from './sponsorSpecificationInternals';
import {
  buildSpecificationRegistry,
  type SponsorSpecificationRegistry,
} from './sponsorSpecificationRegistry';
import {
  generateExecutionSemantics,
  type SponsorExecutionSemanticsRegistry,
  type SponsorSpecificationLayerInput,
} from './sponsorExecutionSemantics';
import {
  resolveConstraintSpecificationGraph,
  type SponsorConstraintSpecificationGraph,
} from './sponsorConstraintSpecificationGraph';
import {
  computeSpecificationLineage,
  type SponsorSpecificationLineage,
} from './sponsorSpecificationLineage';
import {
  generateSpecificationSnapshot,
  type SponsorDeterministicSpecificationSnapshot,
} from './sponsorSpecificationSnapshot';
import {
  buildCanonicalSpecification,
  buildArchitectureCertificationEnvelope,
  lockSpecificationEnvelope,
  type SponsorCanonicalSpecification,
  type SponsorArchitectureCertificationEnvelope,
} from './sponsorArchitectureCertificationEnvelope';

export interface SponsorCanonicalSpecificationResult {
  readonly registry: SponsorSpecificationRegistry;
  readonly semantics: SponsorExecutionSemanticsRegistry;
  readonly specification: SponsorCanonicalSpecification;
  readonly constraintGraph: SponsorConstraintSpecificationGraph;
  readonly lineage: SponsorSpecificationLineage;
  readonly snapshot: SponsorDeterministicSpecificationSnapshot;
  readonly envelope: SponsorArchitectureCertificationEnvelope;
}

export function runCanonicalSpecificationPlane(
  inputs: ReadonlyArray<SponsorSpecificationLayerInput> = [],
): SponsorCanonicalSpecificationResult {
  const registry = buildSpecificationRegistry();
  const semantics = generateExecutionSemantics(inputs);
  const specification = buildCanonicalSpecification(semantics.descriptors);
  const constraintGraph = resolveConstraintSpecificationGraph(semantics.descriptors);
  const lineage = computeSpecificationLineage(semantics.descriptors);
  const snapshot = generateSpecificationSnapshot(registry, semantics, constraintGraph, lineage);
  const envelope = buildArchitectureCertificationEnvelope(
    registry,
    specification,
    semantics,
    constraintGraph,
    lineage,
    snapshot,
  );
  lockSpecificationEnvelope(envelope);
  return Object.freeze({
    registry,
    semantics,
    specification,
    constraintGraph,
    lineage,
    snapshot,
    envelope,
  });
}

export function assertSpecificationDeterminism(
  a: SponsorArchitectureCertificationEnvelope,
  b: SponsorArchitectureCertificationEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorSpecificationDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorSpecificationDeterminismError('registry signature drift');
  }
  if (a.specification.specificationSignature !== b.specification.specificationSignature) {
    throw new SponsorSpecificationDeterminismError('specification signature drift');
  }
  if (a.semantics.semanticsSignature !== b.semantics.semanticsSignature) {
    throw new SponsorSpecificationDeterminismError('semantics signature drift');
  }
  if (a.constraintGraph.graphSignature !== b.constraintGraph.graphSignature) {
    throw new SponsorSpecificationDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorSpecificationDeterminismError('lineage signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorSpecificationDeterminismError('snapshot signature drift');
  }
}
