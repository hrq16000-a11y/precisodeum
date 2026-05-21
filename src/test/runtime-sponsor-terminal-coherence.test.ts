/**
 * Phase 1.9.35 — Sponsor Terminal Coherence Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_COHERENCE_INTERNALS,
  SPONSOR_COHERENCE_LAYER_ORDER,
  SPONSOR_COHERENCE_INVARIANTS,
  assertCoherenceDeterminism,
  buildTerminalCoherence,
} from '@/lib/runtimeSponsorTerminalCoherence';

const sampleInputs = SPONSOR_COHERENCE_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Terminal Coherence Plane (1.9.35)', () => {
  it('marks the plane as read-only with terminal complete coherence mode', () => {
    expect(SPONSOR_COHERENCE_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_COHERENCE_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_COHERENCE_INTERNALS.coherenceMode).toBe('TERMINAL_COMPLETE');
    expect(SPONSOR_COHERENCE_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildTerminalCoherence(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildTerminalCoherence(sampleInputs).envelope;
    const b = buildTerminalCoherence(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertCoherenceDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildTerminalCoherence(sampleInputs).envelope;
    const rollback = buildTerminalCoherence([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildTerminalCoherence(sampleInputs).envelope;
    const drifted = buildTerminalCoherence(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertCoherenceDeterminism(a, drifted)).toThrow();
  });

  it('registers all 21 layers in canonical completeness order', () => {
    const { proofs } = buildTerminalCoherence(sampleInputs);
    expect(proofs.descriptors.length).toBe(21);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_COHERENCE_LAYER_ORDER]);
  });

  it('all completeness proofs are complete', () => {
    const { proofs, invariants } = buildTerminalCoherence(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_COHERENCE_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('complete');
  });

  it('graph includes sequence, completes and closes edges', () => {
    const { graph } = buildTerminalCoherence(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_COHERENCE_LAYER_ORDER.length - 1);
    const completes = graph.edges.filter((e) => e.kind === 'completes');
    expect(completes.length).toBe(
      SPONSOR_COHERENCE_INVARIANTS.length * SPONSOR_COHERENCE_LAYER_ORDER.length,
    );
    const closes = graph.edges.filter((e) => e.kind === 'closes');
    expect(closes.length).toBe(SPONSOR_COHERENCE_LAYER_ORDER.length);
    for (const e of closes) expect(e.to).toBe('terminal:coherence');
  });

  it('graph is reproducible across executions', () => {
    const a = buildTerminalCoherence(sampleInputs).graph;
    const b = buildTerminalCoherence(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal completeness signature', () => {
    const { lineage, proofs } = buildTerminalCoherence(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildTerminalCoherence(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildTerminalCoherence(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
