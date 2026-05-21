/**
 * Phase 1.9.25 — Sponsor System Topology Synthesis · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runSystemTopologySynthesisLayer,
  assertTopologyDeterminism,
  buildSystemTopologyGraph,
  resolveExecutionDependencies,
  computeTopologyLineage,
  buildTopologyRegistry,
  generateTopologySnapshot,
  buildTopologyEnvelope,
  lockTopologyEnvelope,
  SPONSOR_TOPOLOGY_INTERNALS,
  SPONSOR_TOPOLOGY_LAYER_ORDER,
  SponsorTopologyDeterminismError,
  type SponsorTopologyLayerInput,
} from '@/lib/runtimeSponsorSystemTopologySynthesis';

const fixture: ReadonlyArray<SponsorTopologyLayerInput> = [
  { layer: 'mesh', signature: 'sig-mesh' },
  { layer: 'decision', signature: 'sig-decision' },
  { layer: 'campaign', signature: 'sig-campaign' },
  { layer: 'temporal', signature: 'sig-temporal' },
  { layer: 'contract', signature: 'sig-contract' },
  { layer: 'api', signature: 'sig-api' },
  { layer: 'surface', signature: 'sig-surface' },
  { layer: 'consistency', signature: 'sig-consistency' },
  { layer: 'audit', signature: 'sig-audit' },
  { layer: 'governance', signature: 'sig-governance' },
  { layer: 'capability', signature: 'sig-capability' },
];

describe('Sponsor System Topology Synthesis (Phase 1.9.25)', () => {
  it('internals are read-only and zero-mutation', () => {
    expect(SPONSOR_TOPOLOGY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_TOPOLOGY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_TOPOLOGY_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_TOPOLOGY_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_TOPOLOGY_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_TOPOLOGY_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('produces bit-stable snapshots for identical inputs', () => {
    const a = runSystemTopologySynthesisLayer(fixture);
    const b = runSystemTopologySynthesisLayer(fixture);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
    expect(() => assertTopologyDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('topology graph contains all 11 layers (1.9.14 → 1.9.24)', () => {
    const { topology } = runSystemTopologySynthesisLayer(fixture);
    expect(topology.nodes).toHaveLength(11);
    for (const layer of SPONSOR_TOPOLOGY_LAYER_ORDER) {
      expect(topology.nodes.find((n) => n.layer === layer)).toBeDefined();
    }
  });

  it('execution graph topological order respects canonical layer ordering', () => {
    const { execution } = runSystemTopologySynthesisLayer(fixture);
    const order = execution.topologicalOrder;
    // mesh must come before decision, audit must come after consistency
    expect(order.indexOf('mesh')).toBeLessThan(order.indexOf('decision'));
    expect(order.indexOf('consistency')).toBeLessThan(order.indexOf('audit'));
    expect(order.indexOf('audit')).toBeLessThan(order.indexOf('governance'));
    expect(order.indexOf('audit')).toBeLessThan(order.indexOf('capability'));
  });

  it('lineage reconstructs all 11 layers in canonical order', () => {
    const { lineage } = runSystemTopologySynthesisLayer(fixture);
    expect(lineage.entries).toHaveLength(11);
    expect(lineage.entries.map((e) => e.layer)).toEqual([...SPONSOR_TOPOLOGY_LAYER_ORDER]);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runSystemTopologySynthesisLayer(fixture);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.topology.nodes)).toBe(true);
    expect(Object.isFrozen(envelope.execution.nodes)).toBe(true);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tamper';
    }).toThrow();
  });

  it('rollback (re-run) reproduces identical envelopes', () => {
    const a = runSystemTopologySynthesisLayer(fixture);
    const b = runSystemTopologySynthesisLayer(fixture.slice());
    expect(JSON.stringify(a.envelope)).toBe(JSON.stringify(b.envelope));
  });

  it('different upstream signatures yield different envelope signature', () => {
    const a = runSystemTopologySynthesisLayer(fixture);
    const mutated = fixture.map((f) =>
      f.layer === 'mesh' ? { ...f, signature: 'sig-mesh-v2' } : f,
    );
    const b = runSystemTopologySynthesisLayer(mutated);
    expect(a.envelope.envelopeSignature).not.toBe(b.envelope.envelopeSignature);
    expect(() => assertTopologyDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorTopologyDeterminismError,
    );
  });

  it('empty inputs still produce a complete deterministic snapshot', () => {
    const a = runSystemTopologySynthesisLayer();
    const b = runSystemTopologySynthesisLayer([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.topology.nodes).toHaveLength(11);
    for (const n of a.topology.nodes) expect(n.upstreamSignature).toBeNull();
  });

  it('does not mutate upstream input array or signatures', () => {
    const mutable: SponsorTopologyLayerInput[] = fixture.map((f) => ({ ...f }));
    const before = JSON.stringify(mutable);
    runSystemTopologySynthesisLayer(mutable);
    expect(JSON.stringify(mutable)).toBe(before);
  });

  it('execution graph has no cycles and dependencies match edges', () => {
    const topology = buildSystemTopologyGraph(fixture);
    const execution = resolveExecutionDependencies(topology);
    expect(execution.topologicalOrder).toHaveLength(11);
    const meshDeps = execution.nodes.find((n) => n.id === 'mesh')!;
    expect(meshDeps.dependsOn).toEqual([]);
    const governanceDeps = execution.nodes.find((n) => n.id === 'governance')!;
    expect(governanceDeps.dependsOn.length).toBeGreaterThan(0);
  });

  it('input layer ordering does not affect graph signature', () => {
    const reversed = [...fixture].reverse();
    const a = runSystemTopologySynthesisLayer(fixture);
    const b = runSystemTopologySynthesisLayer(reversed);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
  });

  it('registry exposes all 11 layers with correct phases', () => {
    const registry = buildTopologyRegistry();
    expect(registry.entries).toHaveLength(11);
    expect(registry.entries.find((e) => e.layer === 'mesh')?.phase).toBe('1.9.14');
    expect(registry.entries.find((e) => e.layer === 'capability')?.phase).toBe('1.9.24');
  });

  it('snapshot + envelope signatures cover all sub-signatures', () => {
    const topology = buildSystemTopologyGraph(fixture);
    const execution = resolveExecutionDependencies(topology);
    const lineage = computeTopologyLineage(topology);
    const snapshot = generateTopologySnapshot(topology, execution, lineage);
    const registry = buildTopologyRegistry();
    const envelope = buildTopologyEnvelope(registry, topology, execution, lineage, snapshot);
    expect(() => lockTopologyEnvelope(envelope)).not.toThrow();
    expect(snapshot.topologyGraphSignature).toBe(topology.graphSignature);
    expect(snapshot.executionGraphSignature).toBe(execution.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
  });

  it('upstream layer phase metadata is preserved and read-only', () => {
    const { topology } = runSystemTopologySynthesisLayer(fixture);
    const meshNode = topology.nodes.find((n) => n.layer === 'mesh')!;
    expect(meshNode.phase).toBe('1.9.14');
    expect(meshNode.plane).toBe('engine');
    expect(Object.isFrozen(meshNode)).toBe(true);
  });
});
