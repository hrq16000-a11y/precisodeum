/**
 * Phase 1.9.29 — Sponsor System Manifest Plane.
 * Top-level orchestrator. Produces a deterministic, self-describing manifest
 * of the entire sponsor architecture (1.9.14 → 1.9.28).
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorManifestDeterminismError } from './sponsorManifestInternals';
import {
  buildManifestRegistry,
  type SponsorManifestRegistry,
} from './sponsorManifestRegistry';
import {
  generateManifestDescriptors,
  type SponsorManifestDescriptor,
  type SponsorManifestLayerInput,
} from './sponsorManifestDescriptors';
import {
  resolveIntrospectionGraph,
  type SponsorIntrospectionGraph,
} from './sponsorIntrospectionGraph';
import { computeManifestLineage, type SponsorManifestLineage } from './sponsorManifestLineage';
import {
  generateManifestSnapshot,
  type SponsorDeterministicManifestSnapshot,
} from './sponsorManifestSnapshot';
import {
  buildSystemManifest,
  buildManifestEnvelope,
  lockManifestEnvelope,
  type SponsorSystemManifest,
  type SponsorManifestEnvelope,
} from './sponsorManifestEnvelope';

export interface SponsorSystemManifestResult {
  readonly registry: SponsorManifestRegistry;
  readonly descriptors: ReadonlyArray<SponsorManifestDescriptor>;
  readonly manifest: SponsorSystemManifest;
  readonly graph: SponsorIntrospectionGraph;
  readonly lineage: SponsorManifestLineage;
  readonly snapshot: SponsorDeterministicManifestSnapshot;
  readonly envelope: SponsorManifestEnvelope;
}

export function runSystemManifestPlane(
  inputs: ReadonlyArray<SponsorManifestLayerInput> = [],
): SponsorSystemManifestResult {
  const registry = buildManifestRegistry();
  const descriptors = generateManifestDescriptors(inputs);
  const manifest = buildSystemManifest(descriptors);
  const graph = resolveIntrospectionGraph(descriptors);
  const lineage = computeManifestLineage(descriptors);
  const snapshot = generateManifestSnapshot(registry, descriptors, graph, lineage);
  const envelope = buildManifestEnvelope(registry, manifest, graph, lineage, snapshot);
  lockManifestEnvelope(envelope);
  return Object.freeze({
    registry,
    descriptors,
    manifest,
    graph,
    lineage,
    snapshot,
    envelope,
  });
}

export function assertManifestDeterminism(
  a: SponsorManifestEnvelope,
  b: SponsorManifestEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorManifestDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorManifestDeterminismError('registry signature drift');
  }
  if (a.manifest.manifestSignature !== b.manifest.manifestSignature) {
    throw new SponsorManifestDeterminismError('manifest signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorManifestDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorManifestDeterminismError('lineage signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorManifestDeterminismError('snapshot signature drift');
  }
}
