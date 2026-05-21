/**
 * Phase 1.9.32 — Sponsor Meta-Consistency Closure Plane tests.
 * Validates determinism, immutability, canonical ordering and rollback equivalence.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_CLOSURE_INTERNALS,
  SPONSOR_CLOSURE_LAYER_ORDER,
  SPONSOR_CONSISTENCY_THEOREMS,
  assertClosureDeterminism,
  buildMetaConsistencyClosure,
} from '@/lib/runtimeSponsorMetaConsistencyClosure';

const sampleInputs = SPONSOR_CLOSURE_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Meta-Consistency Closure Plane (1.9.32)', () => {
  it('marks the plane as read-only', () => {
    expect(SPONSOR_CLOSURE_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_CLOSURE_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_CLOSURE_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildMetaConsistencyClosure(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.theorems)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildMetaConsistencyClosure(sampleInputs).envelope;
    const b = buildMetaConsistencyClosure(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertClosureDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildMetaConsistencyClosure(sampleInputs).envelope;
    const rollback = buildMetaConsistencyClosure([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildMetaConsistencyClosure(sampleInputs).envelope;
    const drifted = buildMetaConsistencyClosure(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertClosureDeterminism(a, drifted)).toThrow();
  });

  it('registers all 18 layers in canonical order', () => {
    const { proofs } = buildMetaConsistencyClosure(sampleInputs);
    expect(proofs.descriptors.length).toBe(18);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_CLOSURE_LAYER_ORDER]);
  });

  it('registers all consistency theorems with verified verdicts', () => {
    const { theorems, proofs } = buildMetaConsistencyClosure(sampleInputs);
    expect(theorems.theorems.length).toBe(SPONSOR_CONSISTENCY_THEOREMS.length);
    for (const p of proofs.proofs) expect(p.verdict).toBe('verified');
  });

  it('theorem graph is reproducible and canonically ordered', () => {
    const a = buildMetaConsistencyClosure(sampleInputs).graph;
    const b = buildMetaConsistencyClosure(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
    // sequence edges = layers - 1
    const seq = a.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_CLOSURE_LAYER_ORDER.length - 1);
    // certifies edges = theorems * layers
    const cert = a.edges.filter((e) => e.kind === 'certifies');
    expect(cert.length).toBe(SPONSOR_CONSISTENCY_THEOREMS.length * SPONSOR_CLOSURE_LAYER_ORDER.length);
  });

  it('lineage cumulatively chains descriptors', () => {
    const { lineage, proofs } = buildMetaConsistencyClosure(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.entries[0].cumulativeSignature).not.toBe('00000000');
  });

  it('snapshot signature integrates every sub-signature', () => {
    const { snapshot, theorems, proofs, graph, lineage } = buildMetaConsistencyClosure(sampleInputs);
    expect(snapshot.theoremsSignature).toBe(theorems.theoremsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildMetaConsistencyClosure(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
