/**
 * Phase 1.9.29 — Sponsor Manifest Envelope.
 * Locked, frozen, deterministic artifact wrapping the entire manifest plane.
 */
import {
  SPONSOR_MANIFEST_INTERNALS,
  SponsorManifestMutationError,
  deepFreeze,
  signObject,
} from './sponsorManifestInternals';
import type { SponsorManifestRegistry } from './sponsorManifestRegistry';
import type { SponsorManifestDescriptor } from './sponsorManifestDescriptors';
import type { SponsorIntrospectionGraph } from './sponsorIntrospectionGraph';
import type { SponsorManifestLineage } from './sponsorManifestLineage';
import type { SponsorDeterministicManifestSnapshot } from './sponsorManifestSnapshot';

export interface SponsorSystemManifest {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorManifestDescriptor>;
  readonly manifestSignature: string;
}

export function buildSystemManifest(
  descriptors: ReadonlyArray<SponsorManifestDescriptor>,
): SponsorSystemManifest {
  const manifestSignature = signObject(descriptors.map((d) => d.descriptorSignature));
  return deepFreeze({
    version: 'v1' as const,
    descriptors,
    manifestSignature,
  });
}

export interface SponsorManifestEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly registry: SponsorManifestRegistry;
  readonly manifest: SponsorSystemManifest;
  readonly graph: SponsorIntrospectionGraph;
  readonly lineage: SponsorManifestLineage;
  readonly snapshot: SponsorDeterministicManifestSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildManifestEnvelope(
  registry: SponsorManifestRegistry,
  manifest: SponsorSystemManifest,
  graph: SponsorIntrospectionGraph,
  lineage: SponsorManifestLineage,
  snapshot: SponsorDeterministicManifestSnapshot,
): SponsorManifestEnvelope {
  const envelopeSignature = signObject({
    registry: registry.registrySignature,
    manifest: manifest.manifestSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_MANIFEST_INTERNALS.stage,
    registry,
    manifest,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockManifestEnvelope(env: SponsorManifestEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorManifestMutationError('envelope must be frozen and locked');
  }
}
