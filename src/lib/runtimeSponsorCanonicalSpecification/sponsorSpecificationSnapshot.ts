/**
 * Phase 1.9.30 — Sponsor Deterministic Specification Snapshot.
 */
import { deepFreeze, signObject } from './sponsorSpecificationInternals';
import type { SponsorSpecificationRegistry } from './sponsorSpecificationRegistry';
import type { SponsorExecutionSemanticsRegistry } from './sponsorExecutionSemantics';
import type { SponsorConstraintSpecificationGraph } from './sponsorConstraintSpecificationGraph';
import type { SponsorSpecificationLineage } from './sponsorSpecificationLineage';

export interface SponsorDeterministicSpecificationSnapshot {
  readonly version: 'v1';
  readonly layerCount: number;
  readonly presentCount: number;
  readonly constraintCount: number;
  readonly registrySignature: string;
  readonly semanticsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function generateSpecificationSnapshot(
  registry: SponsorSpecificationRegistry,
  semantics: SponsorExecutionSemanticsRegistry,
  graph: SponsorConstraintSpecificationGraph,
  lineage: SponsorSpecificationLineage,
): SponsorDeterministicSpecificationSnapshot {
  const snapshotSignature = signObject({
    registry: registry.registrySignature,
    semantics: semantics.semanticsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    layerCount: semantics.descriptors.length,
    presentCount: semantics.descriptors.filter((d) => d.present).length,
    constraintCount: graph.constraintCount,
    registrySignature: registry.registrySignature,
    semanticsSignature: semantics.semanticsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
