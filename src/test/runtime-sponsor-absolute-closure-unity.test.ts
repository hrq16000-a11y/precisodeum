/**
 * Phase 1.9.39 — Sponsor Absolute Closure-Unity Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_CLOSURE_UNITY_INTERNALS,
  SPONSOR_CLOSURE_UNITY_LAYER_ORDER,
  SPONSOR_CLOSURE_UNITY_INVARIANTS,
  assertClosureUnityDeterminism,
  buildAbsoluteClosureUnity,
} from '@/lib/runtimeSponsorAbsoluteClosureUnity';

const sampleInputs = SPONSOR_CLOSURE_UNITY_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Absolute Closure-Unity Plane (1.9.39)', () => {
  it('marks the plane as read-only with terminal self-contained mode', () => {
    expect(SPONSOR_CLOSURE_UNITY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_CLOSURE_UNITY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_CLOSURE_UNITY_INTERNALS.closureUnityMode).toBe('TERMINAL_SELF_CONTAINED');
    expect(SPONSOR_CLOSURE_UNITY_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildAbsoluteClosureUnity(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildAbsoluteClosureUnity(sampleInputs).envelope;
    const b = buildAbsoluteClosureUnity(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertClosureUnityDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildAbsoluteClosureUnity(sampleInputs).envelope;
    const rollback = buildAbsoluteClosureUnity([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildAbsoluteClosureUnity(sampleInputs).envelope;
    const drifted = buildAbsoluteClosureUnity(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertClosureUnityDeterminism(a, drifted)).toThrow();
  });

  it('registers all 25 layers in canonical self-containment order', () => {
    const { proofs } = buildAbsoluteClosureUnity(sampleInputs);
    expect(proofs.descriptors.length).toBe(25);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_CLOSURE_UNITY_LAYER_ORDER]);
  });

  it('all self-containment proofs verdict is self-contained', () => {
    const { proofs, invariants } = buildAbsoluteClosureUnity(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_CLOSURE_UNITY_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('self-contained');
  });

  it('graph includes sequence, contains and closes edges', () => {
    const { graph } = buildAbsoluteClosureUnity(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_CLOSURE_UNITY_LAYER_ORDER.length - 1);
    const contains = graph.edges.filter((e) => e.kind === 'contains');
    expect(contains.length).toBe(
      SPONSOR_CLOSURE_UNITY_INVARIANTS.length * SPONSOR_CLOSURE_UNITY_LAYER_ORDER.length,
    );
    const closes = graph.edges.filter((e) => e.kind === 'closes');
    expect(closes.length).toBe(SPONSOR_CLOSURE_UNITY_LAYER_ORDER.length);
    for (const e of closes) expect(e.to).toBe('terminal:closure-unity');
  });

  it('graph is reproducible across executions', () => {
    const a = buildAbsoluteClosureUnity(sampleInputs).graph;
    const b = buildAbsoluteClosureUnity(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal closure-unity signature', () => {
    const { lineage, proofs } = buildAbsoluteClosureUnity(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildAbsoluteClosureUnity(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildAbsoluteClosureUnity(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
