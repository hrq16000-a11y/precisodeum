/**
 * Phase 1.9.42 — Sponsor Eternal Canonical Invariance Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_ETERNAL_INTERNALS,
  SPONSOR_ETERNAL_LAYER_ORDER,
  SPONSOR_ETERNAL_INVARIANTS,
  assertEternalDeterminism,
  buildEternalCanonicalState,
} from '@/lib/runtimeSponsorEternalCanonicalInvariance';

const sampleInputs = SPONSOR_ETERNAL_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Eternal Canonical Invariance Plane (1.9.42)', () => {
  it('marks the plane as read-only with terminal permanent invariant mode', () => {
    expect(SPONSOR_ETERNAL_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_ETERNAL_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_ETERNAL_INTERNALS.eternalMode).toBe('TERMINAL_PERMANENT_INVARIANT');
    expect(SPONSOR_ETERNAL_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildEternalCanonicalState(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildEternalCanonicalState(sampleInputs).envelope;
    const b = buildEternalCanonicalState(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertEternalDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildEternalCanonicalState(sampleInputs).envelope;
    const rollback = buildEternalCanonicalState([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.eternalSignature).toBe(rollback.lineage.eternalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildEternalCanonicalState(sampleInputs).envelope;
    const drifted = buildEternalCanonicalState(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertEternalDeterminism(a, drifted)).toThrow();
  });

  it('registers all 28 layers in canonical permanence order', () => {
    const { proofs } = buildEternalCanonicalState(sampleInputs);
    expect(proofs.descriptors.length).toBe(28);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_ETERNAL_LAYER_ORDER]);
  });

  it('all permanent stability proofs verdict is invariant', () => {
    const { proofs, invariants } = buildEternalCanonicalState(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_ETERNAL_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('invariant');
  });

  it('graph includes sequence, certifies and eternalizes edges', () => {
    const { graph } = buildEternalCanonicalState(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_ETERNAL_LAYER_ORDER.length - 1);
    const certifies = graph.edges.filter((e) => e.kind === 'certifies');
    expect(certifies.length).toBe(
      SPONSOR_ETERNAL_INVARIANTS.length * SPONSOR_ETERNAL_LAYER_ORDER.length,
    );
    const eternalizes = graph.edges.filter((e) => e.kind === 'eternalizes');
    expect(eternalizes.length).toBe(SPONSOR_ETERNAL_LAYER_ORDER.length);
    for (const e of eternalizes) expect(e.to).toBe('eternity:permanent');
  });

  it('graph is reproducible across executions', () => {
    const a = buildEternalCanonicalState(sampleInputs).graph;
    const b = buildEternalCanonicalState(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to an eternal signature', () => {
    const { lineage, proofs } = buildEternalCanonicalState(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.eternalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including eternal', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildEternalCanonicalState(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.eternalSignature).toBe(lineage.eternalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildEternalCanonicalState(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
