/**
 * Phase 1.9.41 — Sponsor Canonical Singularity Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_SINGULARITY_INTERNALS,
  SPONSOR_SINGULARITY_LAYER_ORDER,
  SPONSOR_SINGULARITY_INVARIANTS,
  assertSingularityDeterminism,
  buildCanonicalSingularity,
} from '@/lib/runtimeSponsorCanonicalSingularity';

const sampleInputs = SPONSOR_SINGULARITY_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Canonical Singularity Plane (1.9.41)', () => {
  it('marks the plane as read-only with terminal canonical singular mode', () => {
    expect(SPONSOR_SINGULARITY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_SINGULARITY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_SINGULARITY_INTERNALS.singularityMode).toBe('TERMINAL_CANONICAL_SINGULAR');
    expect(SPONSOR_SINGULARITY_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildCanonicalSingularity(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.invariants)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildCanonicalSingularity(sampleInputs).envelope;
    const b = buildCanonicalSingularity(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertSingularityDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildCanonicalSingularity(sampleInputs).envelope;
    const rollback = buildCanonicalSingularity([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(rollback.snapshot.snapshotSignature);
    expect(a.lineage.singularitySignature).toBe(rollback.lineage.singularitySignature);
  });

  it('detects drift when an input signature differs', () => {
    const a = buildCanonicalSingularity(sampleInputs).envelope;
    const drifted = buildCanonicalSingularity(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertSingularityDeterminism(a, drifted)).toThrow();
  });

  it('registers all 27 layers in canonical collapse order', () => {
    const { proofs } = buildCanonicalSingularity(sampleInputs);
    expect(proofs.descriptors.length).toBe(27);
    expect(proofs.descriptors.map((d) => d.id)).toEqual([...SPONSOR_SINGULARITY_LAYER_ORDER]);
  });

  it('all canonical collapse proofs verdict is collapsed', () => {
    const { proofs, invariants } = buildCanonicalSingularity(sampleInputs);
    expect(proofs.proofs.length).toBe(
      invariants.invariants.length * SPONSOR_SINGULARITY_LAYER_ORDER.length,
    );
    for (const p of proofs.proofs) expect(p.verdict).toBe('collapsed');
  });

  it('graph includes sequence, certifies and collapses edges', () => {
    const { graph } = buildCanonicalSingularity(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_SINGULARITY_LAYER_ORDER.length - 1);
    const certifies = graph.edges.filter((e) => e.kind === 'certifies');
    expect(certifies.length).toBe(
      SPONSOR_SINGULARITY_INVARIANTS.length * SPONSOR_SINGULARITY_LAYER_ORDER.length,
    );
    const collapses = graph.edges.filter((e) => e.kind === 'collapses');
    expect(collapses.length).toBe(SPONSOR_SINGULARITY_LAYER_ORDER.length);
    for (const e of collapses) expect(e.to).toBe('singularity:canonical');
  });

  it('graph is reproducible across executions', () => {
    const a = buildCanonicalSingularity(sampleInputs).graph;
    const b = buildCanonicalSingularity(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a canonical singularity signature', () => {
    const { lineage, proofs } = buildCanonicalSingularity(sampleInputs);
    expect(lineage.entries.length).toBe(proofs.descriptors.length);
    expect(lineage.singularitySignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates every sub-signature including singularity', () => {
    const { snapshot, invariants, proofs, graph, lineage } =
      buildCanonicalSingularity(sampleInputs);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.proofsSignature).toBe(proofs.proofsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.singularitySignature).toBe(lineage.singularitySignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildCanonicalSingularity(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
