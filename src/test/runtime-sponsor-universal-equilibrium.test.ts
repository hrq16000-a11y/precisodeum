/**
 * Phase 1.9.36 — Sponsor Universal Equilibrium Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_EQUILIBRIUM_INTERNALS,
  SPONSOR_EQUILIBRIUM_LAYER_ORDER,
  SPONSOR_EQUILIBRIUM_INVARIANTS,
  assertEquilibriumDeterminism,
  buildUniversalEquilibrium,
} from '@/lib/runtimeSponsorUniversalEquilibrium';

const sampleInputs = SPONSOR_EQUILIBRIUM_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Universal Equilibrium Plane (1.9.36)', () => {
  it('marks the plane as read-only with terminal saturated equilibrium mode', () => {
    expect(SPONSOR_EQUILIBRIUM_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_EQUILIBRIUM_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_EQUILIBRIUM_INTERNALS.equilibriumMode).toBe('TERMINAL_SATURATED');
    expect(SPONSOR_EQUILIBRIUM_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildUniversalEquilibrium(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildUniversalEquilibrium(sampleInputs).envelope;
    const b = buildUniversalEquilibrium(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertEquilibriumDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildUniversalEquilibrium(sampleInputs).envelope;
    const rollback = buildUniversalEquilibrium([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildUniversalEquilibrium(sampleInputs).envelope;
    const drifted = buildUniversalEquilibrium(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertEquilibriumDeterminism(a, drifted)).toThrow();
  });

  it('registers all 22 layers in canonical saturation order', () => {
    const { proofs } = buildUniversalEquilibrium(sampleInputs);
    expect(proofs.descriptors.length).toBe(22);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_EQUILIBRIUM_LAYER_ORDER]);
  });

  it('all saturation proofs are saturated', () => {
    const { proofs, invariants } = buildUniversalEquilibrium(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_EQUILIBRIUM_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('saturated');
  });

  it('graph includes sequence, saturates and equilibrates edges', () => {
    const { graph } = buildUniversalEquilibrium(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_EQUILIBRIUM_LAYER_ORDER.length - 1);
    const sat = graph.edges.filter((e) => e.kind === 'saturates');
    expect(sat.length).toBe(
      SPONSOR_EQUILIBRIUM_INVARIANTS.length * SPONSOR_EQUILIBRIUM_LAYER_ORDER.length,
    );
    const eq = graph.edges.filter((e) => e.kind === 'equilibrates');
    expect(eq.length).toBe(SPONSOR_EQUILIBRIUM_LAYER_ORDER.length);
    for (const e of eq) expect(e.to).toBe('terminal:equilibrium');
  });

  it('graph is reproducible across executions', () => {
    const a = buildUniversalEquilibrium(sampleInputs).graph;
    const b = buildUniversalEquilibrium(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal saturation signature', () => {
    const { lineage, proofs } = buildUniversalEquilibrium(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildUniversalEquilibrium(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildUniversalEquilibrium(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
