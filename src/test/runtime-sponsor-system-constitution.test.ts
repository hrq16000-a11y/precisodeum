/**
 * Phase 1.9.31 — Sponsor System Constitution Plane · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runSystemConstitutionPlane,
  assertConstitutionDeterminism,
  generateConstitutionalAxioms,
  buildSupremeInvariantRegistry,
  generateLayerDescriptors,
  resolveConstitutionGraph,
  computeConstitutionLineage,
  generateConstitutionSnapshot,
  buildSystemConstitution,
  buildConstitutionCertificationEnvelope,
  lockConstitutionEnvelope,
  SPONSOR_CONSTITUTION_INTERNALS,
  SPONSOR_CONSTITUTION_LAYER_ORDER,
  SPONSOR_CONSTITUTIONAL_AXIOMS,
  SPONSOR_SUPREME_INVARIANTS,
  SponsorConstitutionDeterminismError,
  type SponsorConstitutionLayerInput,
} from '@/lib/runtimeSponsorSystemConstitution';

const fullInputs: ReadonlyArray<SponsorConstitutionLayerInput> =
  SPONSOR_CONSTITUTION_LAYER_ORDER.map((layer) => ({ layer, signature: `sig-${layer}` }));

describe('Sponsor System Constitution Plane (Phase 1.9.31)', () => {
  it('internals enforce read-only & constitutional invariants', () => {
    expect(SPONSOR_CONSTITUTION_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_CONSTITUTION_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_CONSTITUTION_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_CONSTITUTION_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_CONSTITUTION_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_CONSTITUTION_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('produces bit-stable certification envelopes for identical inputs', () => {
    const a = runSystemConstitutionPlane(fullInputs);
    const b = runSystemConstitutionPlane(fullInputs);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(() => assertConstitutionDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('rollback reproduces identical constitutional envelopes', () => {
    const a = runSystemConstitutionPlane(fullInputs);
    const b = runSystemConstitutionPlane(fullInputs);
    expect(a.axioms.axiomsSignature).toBe(b.axioms.axiomsSignature);
    expect(a.invariants.invariantsSignature).toBe(b.invariants.invariantsSignature);
    expect(a.graph.graphSignature).toBe(b.graph.graphSignature);
    expect(a.constitution.constitutionSignature).toBe(b.constitution.constitutionSignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
  });

  it('describes all 17 layers (1.9.14 → 1.9.30) in canonical order', () => {
    const { graph } = runSystemConstitutionPlane(fullInputs);
    expect(graph.descriptors).toHaveLength(17);
    expect(graph.descriptors.map((d) => d.layer)).toEqual([...SPONSOR_CONSTITUTION_LAYER_ORDER]);
    expect(graph.descriptors.every((d) => d.present)).toBe(true);
  });

  it('axioms and supreme invariants are exposed canonically', () => {
    const axioms = generateConstitutionalAxioms();
    const invariants = buildSupremeInvariantRegistry();
    expect(axioms.axioms).toHaveLength(SPONSOR_CONSTITUTIONAL_AXIOMS.length);
    expect(invariants.invariants).toHaveLength(SPONSOR_SUPREME_INVARIANTS.length);
    expect(axioms.axioms.map((a) => a.id)).toEqual(SPONSOR_CONSTITUTIONAL_AXIOMS.map((a) => a.id));
    expect(invariants.invariants.map((i) => i.id)).toEqual(
      SPONSOR_SUPREME_INVARIANTS.map((i) => i.id),
    );
  });

  it('constitution graph wires axioms → invariants → layers + canonical sequence', () => {
    const { graph } = runSystemConstitutionPlane(fullInputs);
    const layerNodes = graph.nodes.filter((n) => n.kind === 'layer');
    const axiomNodes = graph.nodes.filter((n) => n.kind === 'axiom');
    const invariantNodes = graph.nodes.filter((n) => n.kind === 'invariant');
    expect(layerNodes).toHaveLength(17);
    expect(axiomNodes).toHaveLength(SPONSOR_CONSTITUTIONAL_AXIOMS.length);
    expect(invariantNodes).toHaveLength(SPONSOR_SUPREME_INVARIANTS.length);

    const axiomInvariantEdges = graph.edges.filter((e) => e.relation === 'axiom-invariant');
    expect(axiomInvariantEdges).toHaveLength(SPONSOR_SUPREME_INVARIANTS.length);

    const invariantLayerEdges = graph.edges.filter((e) => e.relation === 'invariant-layer');
    expect(invariantLayerEdges).toHaveLength(SPONSOR_SUPREME_INVARIANTS.length * 17);

    const sequenceEdges = graph.edges.filter((e) => e.relation === 'sequence');
    expect(sequenceEdges).toHaveLength(16);

    expect(graph.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it('lineage forms cumulative signed chain across descriptors', () => {
    const { lineage } = runSystemConstitutionPlane(fullInputs);
    expect(lineage.entries).toHaveLength(17);
    const sigs = new Set(lineage.entries.map((e) => e.cumulativeSignature));
    expect(sigs.size).toBe(17);
  });

  it('snapshot ties axioms + invariants + graph + lineage', () => {
    const axioms = generateConstitutionalAxioms();
    const invariants = buildSupremeInvariantRegistry();
    const descriptors = generateLayerDescriptors(fullInputs);
    const graph = resolveConstitutionGraph(axioms, invariants, descriptors);
    const lineage = computeConstitutionLineage(descriptors);
    const snap = generateConstitutionSnapshot(axioms, invariants, graph, lineage);
    expect(snap.axiomCount).toBe(axioms.axioms.length);
    expect(snap.invariantCount).toBe(invariants.invariants.length);
    expect(snap.layerCount).toBe(17);
    expect(snap.presentCount).toBe(17);
    expect(snap.axiomsSignature).toBe(axioms.axiomsSignature);
    expect(snap.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snap.graphSignature).toBe(graph.graphSignature);
    expect(snap.lineageSignature).toBe(lineage.lineageSignature);
  });

  it('missing inputs mark descriptors absent without breaking determinism', () => {
    const partial = fullInputs.filter((i) => i.layer !== 'specification');
    const a = runSystemConstitutionPlane(partial);
    const b = runSystemConstitutionPlane(partial);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    const spec = a.graph.descriptors.find((d) => d.layer === 'specification');
    expect(spec?.present).toBe(false);
    expect(spec?.signature).toBeNull();
    expect(a.snapshot.presentCount).toBe(16);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runSystemConstitutionPlane(fullInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(() => lockConstitutionEnvelope(envelope)).not.toThrow();
  });

  it('does not mutate the provided input arrays', () => {
    const inputs: SponsorConstitutionLayerInput[] = [...fullInputs];
    const before = inputs.map((i) => i.layer);
    runSystemConstitutionPlane(inputs);
    expect(inputs.map((i) => i.layer)).toEqual(before);
  });

  it('detects envelope drift via assertConstitutionDeterminism', () => {
    const a = runSystemConstitutionPlane(fullInputs);
    const b = runSystemConstitutionPlane(
      fullInputs.map((i) =>
        i.layer === 'topology' ? { layer: i.layer, signature: 'sig-topology-altered' } : i,
      ),
    );
    expect(() => assertConstitutionDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorConstitutionDeterminismError,
    );
  });

  it('handles empty input deterministically (all absent)', () => {
    const a = runSystemConstitutionPlane([]);
    const b = runSystemConstitutionPlane([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.presentCount).toBe(0);
    expect(a.snapshot.layerCount).toBe(17);
  });

  it('buildSystemConstitution signature derives purely from axioms/invariants/graph', () => {
    const axioms = generateConstitutionalAxioms();
    const invariants = buildSupremeInvariantRegistry();
    const descriptors = generateLayerDescriptors(fullInputs);
    const graph = resolveConstitutionGraph(axioms, invariants, descriptors);
    const c1 = buildSystemConstitution(axioms, invariants, graph);
    const c2 = buildSystemConstitution(axioms, invariants, graph);
    expect(c1.constitutionSignature).toBe(c2.constitutionSignature);
  });

  it('certification envelope is deeply frozen', () => {
    const axioms = generateConstitutionalAxioms();
    const invariants = buildSupremeInvariantRegistry();
    const descriptors = generateLayerDescriptors(fullInputs);
    const graph = resolveConstitutionGraph(axioms, invariants, descriptors);
    const constitution = buildSystemConstitution(axioms, invariants, graph);
    const lineage = computeConstitutionLineage(descriptors);
    const snap = generateConstitutionSnapshot(axioms, invariants, graph, lineage);
    const env = buildConstitutionCertificationEnvelope(
      axioms,
      invariants,
      graph,
      constitution,
      lineage,
      snap,
    );
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.axioms)).toBe(true);
    expect(Object.isFrozen(env.invariants)).toBe(true);
    expect(Object.isFrozen(env.graph)).toBe(true);
    expect(Object.isFrozen(env.constitution)).toBe(true);
    expect(Object.isFrozen(env.lineage)).toBe(true);
  });

  it('every supreme invariant binds to an existing axiom', () => {
    const axioms = generateConstitutionalAxioms();
    const invariants = buildSupremeInvariantRegistry();
    const axiomIds = new Set(axioms.axioms.map((a) => a.id));
    for (const inv of invariants.invariants) {
      expect(axiomIds.has(inv.axiom)).toBe(true);
    }
  });
});
