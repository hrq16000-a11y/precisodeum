/**
 * Phase 1.9.30 — Sponsor Canonical Specification Plane · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runCanonicalSpecificationPlane,
  assertSpecificationDeterminism,
  buildSpecificationRegistry,
  generateExecutionSemantics,
  resolveConstraintSpecificationGraph,
  computeSpecificationLineage,
  generateSpecificationSnapshot,
  buildCanonicalSpecification,
  buildArchitectureCertificationEnvelope,
  lockSpecificationEnvelope,
  SPONSOR_SPECIFICATION_INTERNALS,
  SPONSOR_SPECIFICATION_LAYER_ORDER,
  SPONSOR_SPECIFICATION_LAYERS,
  SponsorSpecificationDeterminismError,
  type SponsorSpecificationLayerInput,
} from '@/lib/runtimeSponsorCanonicalSpecification';

const fullInputs: ReadonlyArray<SponsorSpecificationLayerInput> =
  SPONSOR_SPECIFICATION_LAYER_ORDER.map((layer) => ({ layer, signature: `sig-${layer}` }));

describe('Sponsor Canonical Specification Plane (Phase 1.9.30)', () => {
  it('internals enforce read-only & specification invariants', () => {
    expect(SPONSOR_SPECIFICATION_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_SPECIFICATION_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_SPECIFICATION_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_SPECIFICATION_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_SPECIFICATION_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_SPECIFICATION_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('produces bit-stable certification envelopes for identical inputs', () => {
    const a = runCanonicalSpecificationPlane(fullInputs);
    const b = runCanonicalSpecificationPlane(fullInputs);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(() => assertSpecificationDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('rollback reproduces identical specification envelopes', () => {
    const a = runCanonicalSpecificationPlane(fullInputs);
    const b = runCanonicalSpecificationPlane(fullInputs);
    expect(a.specification.specificationSignature).toBe(b.specification.specificationSignature);
    expect(a.semantics.semanticsSignature).toBe(b.semantics.semanticsSignature);
    expect(a.constraintGraph.graphSignature).toBe(b.constraintGraph.graphSignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
  });

  it('describes all 16 layers (1.9.14 → 1.9.29) in canonical order', () => {
    const { semantics } = runCanonicalSpecificationPlane(fullInputs);
    expect(semantics.descriptors).toHaveLength(16);
    expect(semantics.descriptors.map((d) => d.layer)).toEqual([
      ...SPONSOR_SPECIFICATION_LAYER_ORDER,
    ]);
    expect(semantics.descriptors.every((d) => d.present)).toBe(true);
  });

  it('every descriptor carries canonical execution-semantic guarantees', () => {
    const { semantics } = runCanonicalSpecificationPlane(fullInputs);
    for (const d of semantics.descriptors) {
      expect(d.guarantees.length).toBeGreaterThan(0);
      expect(d.guarantees).toContain('rollback-reproducible');
    }
  });

  it('constraint graph preserves canonical ordering and structural integrity', () => {
    const { constraintGraph } = runCanonicalSpecificationPlane(fullInputs);
    expect(constraintGraph.constraintCount).toBeGreaterThan(0);
    const layerNodes = constraintGraph.nodes.filter((n) => n.kind === 'layer');
    const constraintNodes = constraintGraph.nodes.filter((n) => n.kind === 'constraint');
    expect(layerNodes).toHaveLength(16);
    expect(constraintNodes).toHaveLength(constraintGraph.constraintCount);
    const sequenceEdges = constraintGraph.edges.filter((e) => e.relation === 'sequence');
    expect(sequenceEdges).toHaveLength(15);
    expect(constraintGraph.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it('lineage forms cumulative signed chain across descriptors', () => {
    const { lineage } = runCanonicalSpecificationPlane(fullInputs);
    expect(lineage.entries).toHaveLength(16);
    const sigs = new Set(lineage.entries.map((e) => e.cumulativeSignature));
    expect(sigs.size).toBe(16);
  });

  it('snapshot ties registry + semantics + constraint graph + lineage', () => {
    const registry = buildSpecificationRegistry();
    const semantics = generateExecutionSemantics(fullInputs);
    const graph = resolveConstraintSpecificationGraph(semantics.descriptors);
    const lineage = computeSpecificationLineage(semantics.descriptors);
    const snap = generateSpecificationSnapshot(registry, semantics, graph, lineage);
    expect(snap.layerCount).toBe(16);
    expect(snap.presentCount).toBe(16);
    expect(snap.constraintCount).toBe(graph.constraintCount);
    expect(snap.registrySignature).toBe(registry.registrySignature);
    expect(snap.semanticsSignature).toBe(semantics.semanticsSignature);
    expect(snap.graphSignature).toBe(graph.graphSignature);
    expect(snap.lineageSignature).toBe(lineage.lineageSignature);
  });

  it('specification registry exposes all 16 layer specs canonically', () => {
    const registry = buildSpecificationRegistry();
    expect(registry.layers).toHaveLength(16);
    expect(registry.layers.map((l) => l.phase)).toEqual(
      SPONSOR_SPECIFICATION_LAYERS.map((l) => l.phase),
    );
  });

  it('missing inputs mark descriptors as absent without breaking determinism', () => {
    const partial = fullInputs.filter((i) => i.layer !== 'manifest');
    const a = runCanonicalSpecificationPlane(partial);
    const b = runCanonicalSpecificationPlane(partial);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    const manifest = a.semantics.descriptors.find((d) => d.layer === 'manifest');
    expect(manifest?.present).toBe(false);
    expect(manifest?.signature).toBeNull();
    expect(a.snapshot.presentCount).toBe(15);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runCanonicalSpecificationPlane(fullInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(() => lockSpecificationEnvelope(envelope)).not.toThrow();
  });

  it('does not mutate the provided input arrays', () => {
    const inputs: SponsorSpecificationLayerInput[] = [...fullInputs];
    const before = inputs.map((i) => i.layer);
    runCanonicalSpecificationPlane(inputs);
    expect(inputs.map((i) => i.layer)).toEqual(before);
  });

  it('detects envelope drift via assertSpecificationDeterminism', () => {
    const a = runCanonicalSpecificationPlane(fullInputs);
    const b = runCanonicalSpecificationPlane(
      fullInputs.map((i) =>
        i.layer === 'topology' ? { layer: i.layer, signature: 'sig-topology-altered' } : i,
      ),
    );
    expect(() => assertSpecificationDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorSpecificationDeterminismError,
    );
  });

  it('handles empty input deterministically (all absent)', () => {
    const a = runCanonicalSpecificationPlane([]);
    const b = runCanonicalSpecificationPlane([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.presentCount).toBe(0);
    expect(a.snapshot.layerCount).toBe(16);
  });

  it('buildCanonicalSpecification signature derives purely from descriptors', () => {
    const semantics = generateExecutionSemantics(fullInputs);
    const s1 = buildCanonicalSpecification(semantics.descriptors);
    const s2 = buildCanonicalSpecification(semantics.descriptors);
    expect(s1.specificationSignature).toBe(s2.specificationSignature);
  });

  it('certification envelope is deeply frozen', () => {
    const registry = buildSpecificationRegistry();
    const semantics = generateExecutionSemantics(fullInputs);
    const specification = buildCanonicalSpecification(semantics.descriptors);
    const graph = resolveConstraintSpecificationGraph(semantics.descriptors);
    const lineage = computeSpecificationLineage(semantics.descriptors);
    const snap = generateSpecificationSnapshot(registry, semantics, graph, lineage);
    const env = buildArchitectureCertificationEnvelope(
      registry,
      specification,
      semantics,
      graph,
      lineage,
      snap,
    );
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.specification)).toBe(true);
    expect(Object.isFrozen(env.semantics)).toBe(true);
    expect(Object.isFrozen(env.constraintGraph)).toBe(true);
    expect(Object.isFrozen(env.lineage)).toBe(true);
  });
});
