/**
 * Phase 1.9.44 — Sponsor Recursive Infinity Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_INFINITY_INTERNALS,
  SPONSOR_INFINITY_LAYER_ORDER,
  SPONSOR_INFINITY_INVARIANTS,
  assertInfinityDeterminism,
  buildRecursiveInfinityState,
} from '@/lib/runtimeSponsorRecursiveInfinity';

const sampleInputs = SPONSOR_INFINITY_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Recursive Infinity Plane (1.9.44)', () => {
  it('marks the plane as read-only with terminal recursive self-contained mode', () => {
    expect(SPONSOR_INFINITY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_INFINITY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_INFINITY_INTERNALS.infinityMode).toBe('TERMINAL_RECURSIVE_SELF_CONTAINED');
    expect(SPONSOR_INFINITY_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildRecursiveInfinityState(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildRecursiveInfinityState(sampleInputs).envelope;
    const b = buildRecursiveInfinityState(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertInfinityDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildRecursiveInfinityState(sampleInputs).envelope;
    const rollback = buildRecursiveInfinityState([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.infinitySignature).toBe(rollback.lineage.infinitySignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildRecursiveInfinityState(sampleInputs).envelope;
    const drifted = buildRecursiveInfinityState(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertInfinityDeterminism(a, drifted)).toThrow();
  });

  it('registers all 30 layers in canonical recursive order', () => {
    const { proofs } = buildRecursiveInfinityState(sampleInputs);
    expect(proofs.descriptors.length).toBe(30);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_INFINITY_LAYER_ORDER]);
  });

  it('all recursive containment proofs verdict is contained', () => {
    const { proofs, invariants } = buildRecursiveInfinityState(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_INFINITY_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('contained');
  });

  it('graph includes sequence, certifies and contains edges', () => {
    const { graph } = buildRecursiveInfinityState(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_INFINITY_LAYER_ORDER.length - 1);
    const certifies = graph.edges.filter((e) => e.kind === 'certifies');
    expect(certifies.length).toBe(
      SPONSOR_INFINITY_INVARIANTS.length * SPONSOR_INFINITY_LAYER_ORDER.length,
    );
    const contains = graph.edges.filter((e) => e.kind === 'contains');
    expect(contains.length).toBe(SPONSOR_INFINITY_LAYER_ORDER.length);
    for (const e of contains) expect(e.to).toBe('infinity:recursive');
  });

  it('graph is reproducible across executions', () => {
    const a = buildRecursiveInfinityState(sampleInputs).graph;
    const b = buildRecursiveInfinityState(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to an infinity signature', () => {
    const { lineage, proofs } = buildRecursiveInfinityState(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.infinitySignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including infinity', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildRecursiveInfinityState(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.infinitySignature).toBe(lineage.infinitySignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildRecursiveInfinityState(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
