/**
 * Phase 1.9.30 — Sponsor Architecture Certification Envelope.
 * Locked, deeply frozen, deterministic artifact certifying the system architecture.
 */
import {
  SPONSOR_SPECIFICATION_INTERNALS,
  SponsorSpecificationMutationError,
  deepFreeze,
  signObject,
} from './sponsorSpecificationInternals';
import type { SponsorSpecificationRegistry } from './sponsorSpecificationRegistry';
import type {
  SponsorExecutionSemanticDescriptor,
  SponsorExecutionSemanticsRegistry,
} from './sponsorExecutionSemantics';
import type { SponsorConstraintSpecificationGraph } from './sponsorConstraintSpecificationGraph';
import type { SponsorSpecificationLineage } from './sponsorSpecificationLineage';
import type { SponsorDeterministicSpecificationSnapshot } from './sponsorSpecificationSnapshot';

export interface SponsorCanonicalSpecification {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorExecutionSemanticDescriptor>;
  readonly specificationSignature: string;
}

export function buildCanonicalSpecification(
  descriptors: ReadonlyArray<SponsorExecutionSemanticDescriptor>,
): SponsorCanonicalSpecification {
  const specificationSignature = signObject(descriptors.map((d) => d.descriptorSignature));
  return deepFreeze({
    version: 'v1' as const,
    descriptors,
    specificationSignature,
  });
}

export interface SponsorArchitectureCertificationEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly registry: SponsorSpecificationRegistry;
  readonly specification: SponsorCanonicalSpecification;
  readonly semantics: SponsorExecutionSemanticsRegistry;
  readonly constraintGraph: SponsorConstraintSpecificationGraph;
  readonly lineage: SponsorSpecificationLineage;
  readonly snapshot: SponsorDeterministicSpecificationSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildArchitectureCertificationEnvelope(
  registry: SponsorSpecificationRegistry,
  specification: SponsorCanonicalSpecification,
  semantics: SponsorExecutionSemanticsRegistry,
  constraintGraph: SponsorConstraintSpecificationGraph,
  lineage: SponsorSpecificationLineage,
  snapshot: SponsorDeterministicSpecificationSnapshot,
): SponsorArchitectureCertificationEnvelope {
  const envelopeSignature = signObject({
    registry: registry.registrySignature,
    specification: specification.specificationSignature,
    semantics: semantics.semanticsSignature,
    graph: constraintGraph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_SPECIFICATION_INTERNALS.stage,
    registry,
    specification,
    semantics,
    constraintGraph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockSpecificationEnvelope(
  env: SponsorArchitectureCertificationEnvelope,
): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorSpecificationMutationError('envelope must be frozen and locked');
  }
}
