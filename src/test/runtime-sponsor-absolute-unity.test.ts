/**
 * Phase 1.9.37 — Sponsor Absolute Unity Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_UNITY_INTERNALS,
  SPONSOR_UNITY_LAYER_ORDER,
  SPONSOR_UNITY_INVARIANTS,
  assertUnityDeterminism,
  buildAbsoluteUnity,
} from '@/lib/runtimeSponsorAbsoluteUnity';

const sampleInputs = SPONSOR_UNITY_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Absolute Unity Plane (1.9.37)', () => {
  it('marks the plane as read-only with terminal self-equivalent unity mode', () => {
    expect(SPONSOR_UNITY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_UNITY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_UNITY_INTERNALS.unityMode).toBe('TERMINAL_SELF_EQUIVALENT');
    expect(SPONSOR_UNITY_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildAbsoluteUnity(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildAbsoluteUnity(sampleInputs).envelope;
    const b = buildAbsoluteUnity(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertUnityDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildAbsoluteUnity(sampleInputs).envelope;
    const rollback = buildAbsoluteUnity([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildAbsoluteUnity(sampleInputs).envelope;
    const drifted = buildAbsoluteUnity(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertUnityDeterminism(a, drifted)).toThrow();
  });

  it('registers all 23 layers in canonical equivalence order', () => {
    const { proofs } = buildAbsoluteUnity(sampleInputs);
    expect(proofs.descriptors.length).toBe(23);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_UNITY_LAYER_ORDER]);
  });

  it('all self-equivalence proofs verdict is self-equivalent', () => {
    const { proofs, invariants } = buildAbsoluteUnity(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_UNITY_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('self-equivalent');
  });

  it('graph includes sequence, equates and unifies edges', () => {
    const { graph } = buildAbsoluteUnity(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_UNITY_LAYER_ORDER.length - 1);
    const eq = graph.edges.filter((e) => e.kind === 'equates');
    expect(eq.length).toBe(
      SPONSOR_UNITY_INVARIANTS.length * SPONSOR_UNITY_LAYER_ORDER.length,
    );
    const uni = graph.edges.filter((e) => e.kind === 'unifies');
    expect(uni.length).toBe(SPONSOR_UNITY_LAYER_ORDER.length);
    for (const e of uni) expect(e.to).toBe('terminal:unity');
  });

  it('graph is reproducible across executions', () => {
    const a = buildAbsoluteUnity(sampleInputs).graph;
    const b = buildAbsoluteUnity(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal unity signature', () => {
    const { lineage, proofs } = buildAbsoluteUnity(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, invariants, proofs, graph, lineage } = buildAbsoluteUnity(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildAbsoluteUnity(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
