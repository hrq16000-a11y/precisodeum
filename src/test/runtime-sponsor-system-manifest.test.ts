/**
 * Phase 1.9.29 — Sponsor System Manifest Plane · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runSystemManifestPlane,
  assertManifestDeterminism,
  buildManifestRegistry,
  generateManifestDescriptors,
  resolveIntrospectionGraph,
  computeManifestLineage,
  generateManifestSnapshot,
  buildSystemManifest,
  buildManifestEnvelope,
  lockManifestEnvelope,
  SPONSOR_MANIFEST_INTERNALS,
  SPONSOR_MANIFEST_LAYER_ORDER,
  SPONSOR_MANIFEST_LAYERS,
  SponsorManifestDeterminismError,
  type SponsorManifestLayerInput,
} from '@/lib/runtimeSponsorSystemManifest';

const fullInputs: ReadonlyArray<SponsorManifestLayerInput> =
  SPONSOR_MANIFEST_LAYER_ORDER.map((layer) => ({ layer, signature: `sig-${layer}` }));

describe('Sponsor System Manifest Plane (Phase 1.9.29)', () => {
  it('internals enforce read-only & introspection invariants', () => {
    expect(SPONSOR_MANIFEST_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_MANIFEST_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_MANIFEST_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_MANIFEST_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_MANIFEST_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_MANIFEST_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('produces bit-stable manifest envelopes for identical inputs', () => {
    const a = runSystemManifestPlane(fullInputs);
    const b = runSystemManifestPlane(fullInputs);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(() => assertManifestDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('rollback reproduces identical manifest envelopes', () => {
    const a = runSystemManifestPlane(fullInputs);
    const b = runSystemManifestPlane(fullInputs);
    expect(a.manifest.manifestSignature).toBe(b.manifest.manifestSignature);
    expect(a.graph.graphSignature).toBe(b.graph.graphSignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
  });

  it('describes all 15 layers (1.9.14 → 1.9.28) in canonical order', () => {
    const { descriptors } = runSystemManifestPlane(fullInputs);
    expect(descriptors).toHaveLength(15);
    expect(descriptors.map((d) => d.layer)).toEqual([...SPONSOR_MANIFEST_LAYER_ORDER]);
    expect(descriptors.every((d) => d.present)).toBe(true);
  });

  it('introspection graph emits sequence + plane edges deterministically', () => {
    const { graph } = runSystemManifestPlane(fullInputs);
    expect(graph.nodes).toHaveLength(15);
    const sequenceEdges = graph.edges.filter((e) => e.kind === 'sequence');
    expect(sequenceEdges).toHaveLength(14);
    expect(graph.planes.length).toBeGreaterThan(0);
    expect(graph.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it('lineage forms cumulative signed chain across descriptors', () => {
    const { lineage } = runSystemManifestPlane(fullInputs);
    expect(lineage.entries).toHaveLength(15);
    const sigs = new Set(lineage.entries.map((e) => e.cumulativeSignature));
    expect(sigs.size).toBe(15);
  });

  it('snapshot ties registry + descriptors + graph + lineage', () => {
    const registry = buildManifestRegistry();
    const descriptors = generateManifestDescriptors(fullInputs);
    const graph = resolveIntrospectionGraph(descriptors);
    const lineage = computeManifestLineage(descriptors);
    const snap = generateManifestSnapshot(registry, descriptors, graph, lineage);
    expect(snap.layerCount).toBe(15);
    expect(snap.presentCount).toBe(15);
    expect(snap.planeCount).toBe(graph.planes.length);
    expect(snap.registrySignature).toBe(registry.registrySignature);
    expect(snap.graphSignature).toBe(graph.graphSignature);
    expect(snap.lineageSignature).toBe(lineage.lineageSignature);
  });

  it('manifest registry exposes all 15 layer specs canonically', () => {
    const registry = buildManifestRegistry();
    expect(registry.layers).toHaveLength(15);
    expect(registry.layers.map((l) => l.phase)).toEqual(
      SPONSOR_MANIFEST_LAYERS.map((l) => l.phase),
    );
  });

  it('missing inputs mark descriptors as absent without breaking determinism', () => {
    const partial = fullInputs.filter((i) => i.layer !== 'verification');
    const a = runSystemManifestPlane(partial);
    const b = runSystemManifestPlane(partial);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    const verification = a.descriptors.find((d) => d.layer === 'verification');
    expect(verification?.present).toBe(false);
    expect(verification?.signature).toBeNull();
    expect(a.snapshot.presentCount).toBe(14);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runSystemManifestPlane(fullInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(() => lockManifestEnvelope(envelope)).not.toThrow();
  });

  it('does not mutate the provided input arrays', () => {
    const inputs: SponsorManifestLayerInput[] = [...fullInputs];
    const before = inputs.map((i) => i.layer);
    runSystemManifestPlane(inputs);
    expect(inputs.map((i) => i.layer)).toEqual(before);
  });

  it('detects envelope drift via assertManifestDeterminism', () => {
    const a = runSystemManifestPlane(fullInputs);
    const b = runSystemManifestPlane(
      fullInputs.map((i) =>
        i.layer === 'topology' ? { layer: i.layer, signature: 'sig-topology-altered' } : i,
      ),
    );
    expect(() => assertManifestDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorManifestDeterminismError,
    );
  });

  it('handles empty input deterministically (all absent)', () => {
    const a = runSystemManifestPlane([]);
    const b = runSystemManifestPlane([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.presentCount).toBe(0);
    expect(a.snapshot.layerCount).toBe(15);
  });

  it('buildSystemManifest signature derives purely from descriptors', () => {
    const descriptors = generateManifestDescriptors(fullInputs);
    const m1 = buildSystemManifest(descriptors);
    const m2 = buildSystemManifest(descriptors);
    expect(m1.manifestSignature).toBe(m2.manifestSignature);
  });

  it('buildManifestEnvelope returns a deeply frozen artifact', () => {
    const registry = buildManifestRegistry();
    const descriptors = generateManifestDescriptors(fullInputs);
    const manifest = buildSystemManifest(descriptors);
    const graph = resolveIntrospectionGraph(descriptors);
    const lineage = computeManifestLineage(descriptors);
    const snap = generateManifestSnapshot(registry, descriptors, graph, lineage);
    const env = buildManifestEnvelope(registry, manifest, graph, lineage, snap);
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.manifest)).toBe(true);
    expect(Object.isFrozen(env.graph)).toBe(true);
    expect(Object.isFrozen(env.lineage)).toBe(true);
  });
});
