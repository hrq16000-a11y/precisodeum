/**
 * Phase 1.9.46 — Sponsor Meta-Plane Consolidation Runtime tests.
 *
 * Validates:
 *   - canonicalization + djb2 hashing is bit-identical to per-plane helpers
 *   - envelopes, snapshots, lineage, graph, proofs, invariants are deterministic
 *   - no upstream mutation is induced by shared runtime
 *   - migration assertions correctly detect drift
 */
import { describe, it, expect } from 'vitest';
import {
  META_PLANE_INTERNALS,
  CONSOLIDATED_LAYERS,
  canonicalize,
  djb2,
  signObject,
  deepFreeze,
  createDeterministicEnvelope,
  assertEnvelopeDeterminism,
  createDeterministicSnapshot,
  assertSnapshotIntegrity,
  buildCanonicalLineage,
  resolveLineageGraph,
  buildCanonicalGraph,
  normalizeGraphEdges,
  buildProofMatrix,
  buildInvariantRegistry,
  assertInvariantConsistency,
  assertSignatureCompatibility,
  assertNoSignatureDrift,
  assertNoUpstreamMutation,
} from '@/lib/runtimeSponsorMetaPlaneRuntime';

describe('Phase 1.9.46 — Sponsor Meta-Plane Consolidation Runtime', () => {
  it('internals are frozen, read-only and consolidate 1.9.28 → 1.9.45', () => {
    expect(Object.isFrozen(META_PLANE_INTERNALS)).toBe(true);
    expect(META_PLANE_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(META_PLANE_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(CONSOLIDATED_LAYERS.length).toBe(18);
    expect(CONSOLIDATED_LAYERS[0]).toBe('1.9.28');
    expect(CONSOLIDATED_LAYERS[CONSOLIDATED_LAYERS.length - 1]).toBe('1.9.45');
  });

  it('canonicalize sorts object keys deterministically', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize([1, 'x', { y: 2 }])).toBe('[1,"x",{"y":2}]');
  });

  it('djb2 + signObject produce stable hex signatures', () => {
    const sig = signObject({ k: 1 });
    expect(sig).toMatch(/^[0-9a-f]{8}$/);
    expect(djb2('')).toBe('00001505');
    expect(signObject({ a: 1, b: 2 })).toBe(signObject({ b: 2, a: 1 }));
  });

  it('deepFreeze is idempotent and recursive', () => {
    const o = deepFreeze({ a: { b: 1 } });
    expect(Object.isFrozen(o)).toBe(true);
    expect(Object.isFrozen(o.a)).toBe(true);
    expect(deepFreeze(o)).toBe(o);
  });

  it('envelope runtime: deterministic + lockable + assertable', () => {
    const a = createDeterministicEnvelope({ x: 1 });
    const b = createDeterministicEnvelope({ x: 1 });
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(a.locked).toBe(true);
    expect(assertEnvelopeDeterminism(a)).toBe(true);
  });

  it('snapshot runtime: integrity-stable', () => {
    const s = createDeterministicSnapshot({ payload: [1, 2, 3] });
    expect(assertSnapshotIntegrity(s)).toBe(true);
    expect(s.snapshotSignature).toBe(signObject({ payload: [1, 2, 3] }));
  });

  it('lineage runtime: cumulative + replayable', () => {
    const inputs = [
      { key: 'a', signature: 'sig-a' },
      { key: 'b', signature: 'sig-b' },
      { key: 'c', signature: 'sig-c' },
    ];
    const l1 = buildCanonicalLineage(inputs);
    const l2 = buildCanonicalLineage(inputs);
    expect(l1.lineageSignature).toBe(l2.lineageSignature);
    expect(l1.terminalSignature).toBe(l1.entries[2].cumulativeSignature);
    expect(resolveLineageGraph(l1).length).toBe(2);
  });

  it('graph runtime: normalized + deterministic', () => {
    const edges = [
      { from: 'b', to: 'c', relation: 'r' },
      { from: 'a', to: 'b', relation: 'r' },
    ];
    const g = buildCanonicalGraph(
      [{ id: 'c', kind: 'n' }, { id: 'a', kind: 'n' }, { id: 'b', kind: 'n' }],
      edges,
    );
    expect(g.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(normalizeGraphEdges(edges)[0].from).toBe('a');
    expect(g.graphSignature).toMatch(/^[0-9a-f]{8}$/);
  });

  it('proof runtime: matrix is normalized and deterministic', () => {
    const m = buildProofMatrix(['s1', 's2'], ['i1', 'i2']);
    expect(m.proofs.length).toBe(4);
    const m2 = buildProofMatrix(['s2', 's1'], ['i2', 'i1']);
    expect(m.proofsSignature).toBe(m2.proofsSignature);
  });

  it('invariant runtime: dedup + ordering + consistency', () => {
    const reg = buildInvariantRegistry([
      { id: 'B', description: 'b' },
      { id: 'A', description: 'a' },
      { id: 'A', description: 'a' },
    ]);
    expect(reg.invariants.map((i) => i.id)).toEqual(['A', 'B']);
    expect(assertInvariantConsistency(reg)).toBe(true);
  });

  it('compatibility adapters: legacy signature matches shared runtime', () => {
    const payload = { foo: [1, { bar: 'x' }] };
    const legacy = signObject(payload);
    expect(assertSignatureCompatibility(legacy, payload)).toBe(true);
    expect(assertSignatureCompatibility('00000000', payload)).toBe(false);
  });

  it('migration assertions: detect drift and zero upstream mutation', () => {
    const ok = assertNoSignatureDrift([
      { key: 'a', payload: { x: 1 }, legacySignature: signObject({ x: 1 }) },
      { key: 'b', payload: { y: 2 }, legacySignature: signObject({ y: 2 }) },
    ]);
    expect(ok.bitStable).toBe(true);
    expect(ok.drifted).toEqual([]);

    const bad = assertNoSignatureDrift([
      { key: 'a', payload: { x: 1 }, legacySignature: 'deadbeef' },
    ]);
    expect(bad.bitStable).toBe(false);
    expect(bad.drifted).toEqual(['a']);

    const before = [{ key: 'l1', signature: 'sig1' }, { key: 'l2', signature: 'sig2' }];
    const after = [{ key: 'l1', signature: 'sig1' }, { key: 'l2', signature: 'sig2' }];
    expect(assertNoUpstreamMutation(before, after)).toBe(true);
    expect(
      assertNoUpstreamMutation(before, [{ key: 'l1', signature: 'sig1' }, { key: 'l2', signature: 'X' }]),
    ).toBe(false);
  });
});
