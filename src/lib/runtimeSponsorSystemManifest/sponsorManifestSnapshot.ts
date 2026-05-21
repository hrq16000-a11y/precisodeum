/**
 * Phase 1.9.29 — Sponsor Deterministic Manifest Snapshot.
 */
import { deepFreeze, signObject } from './sponsorManifestInternals';
import type { SponsorManifestRegistry } from './sponsorManifestRegistry';
import type { SponsorManifestDescriptor } from './sponsorManifestDescriptors';
import type { SponsorIntrospectionGraph } from './sponsorIntrospectionGraph';
import type { SponsorManifestLineage } from './sponsorManifestLineage';

export interface SponsorDeterministicManifestSnapshot {
  readonly version: 'v1';
  readonly layerCount: number;
  readonly presentCount: number;
  readonly planeCount: number;
  readonly registrySignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function generateManifestSnapshot(
  registry: SponsorManifestRegistry,
  descriptors: ReadonlyArray<SponsorManifestDescriptor>,
  graph: SponsorIntrospectionGraph,
  lineage: SponsorManifestLineage,
): SponsorDeterministicManifestSnapshot {
  const descriptorsSignature = signObject(descriptors.map((d) => d.descriptorSignature));
  const snapshotSignature = signObject({
    registry: registry.registrySignature,
    descriptors: descriptorsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    layerCount: descriptors.length,
    presentCount: descriptors.filter((d) => d.present).length,
    planeCount: graph.planes.length,
    registrySignature: registry.registrySignature,
    descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
