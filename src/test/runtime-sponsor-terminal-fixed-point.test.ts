/**
 * Phase 1.9.33 — Sponsor Terminal Fixed-Point Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_FIXED_POINT_INTERNALS,
  SPONSOR_FIXED_POINT_LAYER_ORDER,
  SPONSOR_FIXED_POINT_CONSENSUS,
  assertFixedPointDeterminism,
  buildTerminalFixedPoint,
} from '@/lib/runtimeSponsorTerminalFixedPoint';

const sampleInputs = SPONSOR_FIXED_POINT_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Terminal Fixed-Point Plane (1.9.33)', () => {
  it('marks the plane as read-only with terminal convergence mode', () => {
    expect(SPONSOR_FIXED_POINT_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_FIXED_POINT_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_FIXED_POINT_INTERNALS.convergenceMode).toBe('TERMINAL_IMMUTABLE');
    expect(SPONSOR_FIXED_POINT_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildTerminalFixedPoint(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.consensus)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildTerminalFixedPoint(sampleInputs).envelope;
    const b = buildTerminalFixedPoint(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertFixedPointDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildTerminalFixedPoint(sampleInputs).envelope;
    const rollback = buildTerminalFixedPoint([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildTerminalFixedPoint(sampleInputs).envelope;
    const drifted = buildTerminalFixedPoint(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertFixedPointDeterminism(a, drifted)).toThrow();
  });

  it('registers all 19 layers in canonical order', () => {
    const { proofs } = buildTerminalFixedPoint(sampleInputs);
    expect(proofs.descriptors.length).toBe(19);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_FIXED_POINT_LAYER_ORDER]);
  });

  it('all consensus statements converge', () => {
    const { consensus, proofs } = buildTerminalFixedPoint(sampleInputs);
    expect(consensus.consensus.length).toBe(SPONSOR_FIXED_POINT_CONSENSUS.length);
    for (const p of proofs.proofs) expect(p.verdict).toBe('converged');
  });

  it('graph includes sequence + converges + fixed-point self-loop', () => {
    const { graph } = buildTerminalFixedPoint(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_FIXED_POINT_LAYER_ORDER.length - 1);
    const fp = graph.edges.filter((e) => e.kind === 'fixed-point');
    expect(fp.length).toBe(1);
    expect(fp[0].from).toBe(fp[0].to);
    const conv = graph.edges.filter((e) => e.kind === 'converges');
    expect(conv.length).toBe(
      SPONSOR_FIXED_POINT_CONSENSUS.length * SPONSOR_FIXED_POINT_LAYER_ORDER.length +
        SPONSOR_FIXED_POINT_LAYER_ORDER.length,
    );
  });

  it('graph is reproducible across executions', () => {
    const a = buildTerminalFixedPoint(sampleInputs).graph;
    const b = buildTerminalFixedPoint(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal signature', () => {
    const { lineage, proofs } = buildTerminalFixedPoint(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, consensus, proofs, graph, lineage } =
      buildTerminalFixedPoint(sampleInputs);
    expect(snapshot.consensusSignature).toBe(consensus.consensusSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildTerminalFixedPoint(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
