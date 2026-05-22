/**
 * Phase 1.9.43 — Sponsor Transcendent Meta-Identity Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_TRANSCENDENT_INTERNALS,
  SPONSOR_TRANSCENDENT_LAYER_ORDER,
  SPONSOR_TRANSCENDENT_INVARIANTS,
  assertTranscendentDeterminism,
  buildTranscendentIdentityState,
} from '@/lib/runtimeSponsorTranscendentMetaIdentity';

const sampleInputs = SPONSOR_TRANSCENDENT_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Transcendent Meta-Identity Plane (1.9.43)', () => {
  it('marks the plane as read-only with terminal universal self-equivalent mode', () => {
    expect(SPONSOR_TRANSCENDENT_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_TRANSCENDENT_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_TRANSCENDENT_INTERNALS.transcendentMode).toBe(
      'TERMINAL_UNIVERSAL_SELF_EQUIVALENT',
    );
    expect(SPONSOR_TRANSCENDENT_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildTranscendentIdentityState(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildTranscendentIdentityState(sampleInputs).envelope;
    const b = buildTranscendentIdentityState(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertTranscendentDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildTranscendentIdentityState(sampleInputs).envelope;
    const rollback = buildTranscendentIdentityState([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.transcendentSignature).toBe(rollback.lineage.transcendentSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildTranscendentIdentityState(sampleInputs).envelope;
    const drifted = buildTranscendentIdentityState(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertTranscendentDeterminism(a, drifted)).toThrow();
  });

  it('registers all 29 layers in canonical transcendence order', () => {
    const { proofs } = buildTranscendentIdentityState(sampleInputs);
    expect(proofs.descriptors.length).toBe(29);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_TRANSCENDENT_LAYER_ORDER]);
  });

  it('all universal self-equivalence proofs verdict is self-equivalent', () => {
    const { proofs, invariants } = buildTranscendentIdentityState(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_TRANSCENDENT_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('self-equivalent');
  });

  it('graph includes sequence, certifies and transcends edges', () => {
    const { graph } = buildTranscendentIdentityState(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_TRANSCENDENT_LAYER_ORDER.length - 1);
    const certifies = graph.edges.filter((e) => e.kind === 'certifies');
    expect(certifies.length).toBe(
      SPONSOR_TRANSCENDENT_INVARIANTS.length * SPONSOR_TRANSCENDENT_LAYER_ORDER.length,
    );
    const transcends = graph.edges.filter((e) => e.kind === 'transcends');
    expect(transcends.length).toBe(SPONSOR_TRANSCENDENT_LAYER_ORDER.length);
    for (const e of transcends) expect(e.to).toBe('transcendence:universal');
  });

  it('graph is reproducible across executions', () => {
    const a = buildTranscendentIdentityState(sampleInputs).graph;
    const b = buildTranscendentIdentityState(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a transcendent signature', () => {
    const { lineage, proofs } = buildTranscendentIdentityState(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.transcendentSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including transcendent', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildTranscendentIdentityState(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.transcendentSignature).toBe(lineage.transcendentSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildTranscendentIdentityState(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
