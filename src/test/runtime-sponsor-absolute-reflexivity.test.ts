/**
 * Phase 1.9.38 — Sponsor Absolute Reflexivity Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_REFLEXIVITY_INTERNALS,
  SPONSOR_REFLEXIVITY_LAYER_ORDER,
  SPONSOR_REFLEXIVITY_INVARIANTS,
  assertReflexivityDeterminism,
  buildAbsoluteReflexivity,
} from '@/lib/runtimeSponsorAbsoluteReflexivity';

const sampleInputs = SPONSOR_REFLEXIVITY_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Absolute Reflexivity Plane (1.9.38)', () => {
  it('marks the plane as read-only with terminal meta-recursive mode', () => {
    expect(SPONSOR_REFLEXIVITY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_REFLEXIVITY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_REFLEXIVITY_INTERNALS.reflexivityMode).toBe('TERMINAL_META_RECURSIVE');
    expect(SPONSOR_REFLEXIVITY_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildAbsoluteReflexivity(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildAbsoluteReflexivity(sampleInputs).envelope;
    const b = buildAbsoluteReflexivity(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertReflexivityDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildAbsoluteReflexivity(sampleInputs).envelope;
    const rollback = buildAbsoluteReflexivity([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildAbsoluteReflexivity(sampleInputs).envelope;
    const drifted = buildAbsoluteReflexivity(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertReflexivityDeterminism(a, drifted)).toThrow();
  });

  it('registers all 24 layers in canonical recursive order', () => {
    const { proofs } = buildAbsoluteReflexivity(sampleInputs);
    expect(proofs.descriptors.length).toBe(24);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_REFLEXIVITY_LAYER_ORDER]);
  });

  it('all recursive completeness proofs verdict is self-described', () => {
    const { proofs, invariants } = buildAbsoluteReflexivity(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_REFLEXIVITY_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('self-described');
  });

  it('graph includes sequence, describes and reflects edges', () => {
    const { graph } = buildAbsoluteReflexivity(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_REFLEXIVITY_LAYER_ORDER.length - 1);
    const desc = graph.edges.filter((e) => e.kind === 'describes');
    expect(desc.length).toBe(
      SPONSOR_REFLEXIVITY_INVARIANTS.length * SPONSOR_REFLEXIVITY_LAYER_ORDER.length,
    );
    const refl = graph.edges.filter((e) => e.kind === 'reflects');
    expect(refl.length).toBe(SPONSOR_REFLEXIVITY_LAYER_ORDER.length);
    for (const e of refl) expect(e.to).toBe('terminal:reflexivity');
  });

  it('graph is reproducible across executions', () => {
    const a = buildAbsoluteReflexivity(sampleInputs).graph;
    const b = buildAbsoluteReflexivity(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal reflexivity signature', () => {
    const { lineage, proofs } = buildAbsoluteReflexivity(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildAbsoluteReflexivity(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildAbsoluteReflexivity(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
