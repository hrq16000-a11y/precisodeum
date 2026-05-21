/**
 * Phase 1.9.26 — Sponsor Unified World State · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runUnifiedWorldStateLayer,
  composeWorldSnapshots,
  assertWorldDeterminism,
  buildUnifiedWorldState,
  resolveCompositionGraph,
  computeWorldLineage,
  buildWorldRegistry,
  generateWorldSnapshot,
  buildWorldEnvelope,
  lockWorldEnvelope,
  SPONSOR_WORLD_INTERNALS,
  SPONSOR_WORLD_LAYER_ORDER,
  SponsorWorldDeterminismError,
  type SponsorWorldLayerInput,
} from '@/lib/runtimeSponsorUnifiedWorldState';

const fixture: ReadonlyArray<SponsorWorldLayerInput> = [
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
  { layer: 'topology', signature: 'sig-topology' },
];

describe('Sponsor Unified World State (Phase 1.9.26)', () => {
  it('internals are read-only and zero-mutation', () => {
    expect(SPONSOR_WORLD_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_WORLD_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_WORLD_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_WORLD_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_WORLD_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_WORLD_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('produces bit-stable world snapshots for identical inputs', () => {
    const a = runUnifiedWorldStateLayer(fixture);
    const b = runUnifiedWorldStateLayer(fixture);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
    expect(() => assertWorldDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('unified state contains all 12 layers (1.9.14 → 1.9.25)', () => {
    const { state } = runUnifiedWorldStateLayer(fixture);
    expect(state.entries).toHaveLength(12);
    for (const layer of SPONSOR_WORLD_LAYER_ORDER) {
      expect(state.entries.find((e) => e.layer === layer)).toBeDefined();
    }
  });

  it('composition graph fuses every layer with all previous ones', () => {
    const { composition } = runUnifiedWorldStateLayer(fixture);
    expect(composition.nodes).toHaveLength(12);
    expect(composition.edges).toHaveLength(11);
    const last = composition.nodes[composition.nodes.length - 1];
    expect(last.fuses).toHaveLength(11);
    expect(composition.nodes[0].fuses).toEqual([]);
  });

  it('lineage reconstructs all 12 layers in canonical order', () => {
    const { lineage } = runUnifiedWorldStateLayer(fixture);
    expect(lineage.entries).toHaveLength(12);
    expect(lineage.entries.map((e) => e.layer)).toEqual([...SPONSOR_WORLD_LAYER_ORDER]);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runUnifiedWorldStateLayer(fixture);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.state.entries)).toBe(true);
    expect(Object.isFrozen(envelope.composition.nodes)).toBe(true);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tamper';
    }).toThrow();
  });

  it('rollback (re-run) reproduces identical envelopes', () => {
    const a = runUnifiedWorldStateLayer(fixture);
    const b = runUnifiedWorldStateLayer(fixture.slice());
    expect(JSON.stringify(a.envelope)).toBe(JSON.stringify(b.envelope));
  });

  it('different upstream signature yields different envelope', () => {
    const a = runUnifiedWorldStateLayer(fixture);
    const mutated = fixture.map((f) =>
      f.layer === 'topology' ? { ...f, signature: 'sig-topology-v2' } : f,
    );
    const b = runUnifiedWorldStateLayer(mutated);
    expect(a.envelope.envelopeSignature).not.toBe(b.envelope.envelopeSignature);
    expect(() => assertWorldDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorWorldDeterminismError,
    );
  });

  it('empty inputs still produce a complete deterministic snapshot', () => {
    const a = runUnifiedWorldStateLayer();
    const b = runUnifiedWorldStateLayer([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.state.entries).toHaveLength(12);
    for (const e of a.state.entries) expect(e.signature).toBeNull();
  });

  it('does not mutate upstream input array', () => {
    const mutable: SponsorWorldLayerInput[] = fixture.map((f) => ({ ...f }));
    const before = JSON.stringify(mutable);
    runUnifiedWorldStateLayer(mutable);
    expect(JSON.stringify(mutable)).toBe(before);
  });

  it('input ordering does not affect world signature (canonical sort)', () => {
    const a = runUnifiedWorldStateLayer(fixture);
    const b = runUnifiedWorldStateLayer([...fixture].reverse());
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
  });

  it('registry exposes all 12 layers with correct phases', () => {
    const registry = buildWorldRegistry();
    expect(registry.entries).toHaveLength(12);
    expect(registry.entries.find((e) => e.layer === 'mesh')?.phase).toBe('1.9.14');
    expect(registry.entries.find((e) => e.layer === 'topology')?.phase).toBe('1.9.25');
  });

  it('snapshot signature covers state + composition + lineage', () => {
    const state = buildUnifiedWorldState(fixture);
    const composition = resolveCompositionGraph(state);
    const lineage = computeWorldLineage(state);
    const snapshot = generateWorldSnapshot(state, composition, lineage);
    const registry = buildWorldRegistry();
    const envelope = buildWorldEnvelope(registry, state, composition, lineage, snapshot);
    expect(() => lockWorldEnvelope(envelope)).not.toThrow();
    expect(snapshot.stateSignature).toBe(state.stateSignature);
    expect(snapshot.compositionSignature).toBe(composition.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
  });

  it('composeWorldSnapshots convenience helper matches full pipeline', () => {
    const snapA = composeWorldSnapshots(fixture);
    const snapB = runUnifiedWorldStateLayer(fixture).snapshot;
    expect(snapA.snapshotSignature).toBe(snapB.snapshotSignature);
  });
});
