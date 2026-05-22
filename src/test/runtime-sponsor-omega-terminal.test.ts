/**
 * Phase 1.9.40 — Sponsor Omega Terminal Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_OMEGA_INTERNALS,
  SPONSOR_OMEGA_LAYER_ORDER,
  SPONSOR_OMEGA_INVARIANTS,
  assertOmegaDeterminism,
  buildOmegaTerminalState,
} from '@/lib/runtimeSponsorOmegaTerminal';

const sampleInputs = SPONSOR_OMEGA_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Omega Terminal Plane (1.9.40)', () => {
  it('marks the plane as read-only with terminal irreducible mode', () => {
    expect(SPONSOR_OMEGA_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_OMEGA_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_OMEGA_INTERNALS.omegaMode).toBe('TERMINAL_IRREDUCIBLE');
    expect(SPONSOR_OMEGA_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildOmegaTerminalState(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildOmegaTerminalState(sampleInputs).envelope;
    const b = buildOmegaTerminalState(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertOmegaDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildOmegaTerminalState(sampleInputs).envelope;
    const rollback = buildOmegaTerminalState([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildOmegaTerminalState(sampleInputs).envelope;
    const drifted = buildOmegaTerminalState(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertOmegaDeterminism(a, drifted)).toThrow();
  });

  it('registers all 26 layers in canonical irreducibility order', () => {
    const { proofs } = buildOmegaTerminalState(sampleInputs);
    expect(proofs.descriptors.length).toBe(26);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_OMEGA_LAYER_ORDER]);
  });

  it('all irreducible completeness proofs verdict is irreducible', () => {
    const { proofs, invariants } = buildOmegaTerminalState(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_OMEGA_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('irreducible');
  });

  it('graph includes sequence, certifies and terminates edges', () => {
    const { graph } = buildOmegaTerminalState(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_OMEGA_LAYER_ORDER.length - 1);
    const certifies = graph.edges.filter((e) => e.kind === 'certifies');
    expect(certifies.length).toBe(
      SPONSOR_OMEGA_INVARIANTS.length * SPONSOR_OMEGA_LAYER_ORDER.length,
    );
    const terminates = graph.edges.filter((e) => e.kind === 'terminates');
    expect(terminates.length).toBe(SPONSOR_OMEGA_LAYER_ORDER.length);
    for (const e of terminates) expect(e.to).toBe('terminal:omega');
  });

  it('graph is reproducible across executions', () => {
    const a = buildOmegaTerminalState(sampleInputs).graph;
    const b = buildOmegaTerminalState(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal omega signature', () => {
    const { lineage, proofs } = buildOmegaTerminalState(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including terminal', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildOmegaTerminalState(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildOmegaTerminalState(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
