/**
 * Phase 1.9.24 — Capability Snapshot.
 * Deterministic frozen snapshot of the capability plane.
 */
import { deepFreeze, signObject } from './sponsorCapabilityInternals';
import type { SponsorCapabilityRegistry } from './sponsorCapabilityRegistry';
import type { SponsorEntitlementMatrix } from './sponsorEntitlementMatrix';
import type { SponsorCapabilityCompatibilityGraph } from './sponsorCapabilityCompatibility';
import type { SponsorCapabilityLineage } from './sponsorCapabilityLineage';

export interface SponsorCapabilitySnapshot {
  readonly snapshotVersion: 'v1';
  readonly registrySignature: string;
  readonly matrixSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly capabilityCount: number;
  readonly surfaceCount: number;
  readonly snapshotSignature: string;
}

export function generateCapabilitySnapshot(
  registry: SponsorCapabilityRegistry,
  matrix: SponsorEntitlementMatrix,
  graph: SponsorCapabilityCompatibilityGraph,
  lineage: SponsorCapabilityLineage,
): SponsorCapabilitySnapshot {
  const capabilityCount = registry.capabilities.length;
  const surfaceCount = new Set(registry.capabilities.map((c) => c.surface)).size;
  const snapshotSignature = signObject({
    v: 'v1',
    registry: registry.registrySignature,
    matrix: matrix.matrixSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    capabilityCount,
    surfaceCount,
  });
  return deepFreeze({
    snapshotVersion: 'v1' as const,
    registrySignature: registry.registrySignature,
    matrixSignature: matrix.matrixSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    capabilityCount,
    surfaceCount,
    snapshotSignature,
  });
}
