/**
 * Phase 1.9.34 — Sponsor Absolute Existence Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_EXISTENCE_INTERNALS,
  SPONSOR_EXISTENCE_LAYER_ORDER,
  SPONSOR_EXISTENCE_INVARIANTS,
  assertExistenceDeterminism,
  buildAbsoluteExistence,
} from '@/lib/runtimeSponsorAbsoluteExistence';

const sampleInputs = SPONSOR_EXISTENCE_LAYER_ORDER.map((id, i) => ({
  id,
  upstreamSignature: `sig-${i.toString(16).padStart(2, '0')}`,
}));

describe('Sponsor Absolute Existence Plane (1.9.34)', () => {
  it('marks the plane as read-only with absolute immutable identity mode', () => {
    expect(SPONSOR_EXISTENCE_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_EXISTENCE_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_EXISTENCE_INTERNALS.identityMode).toBe('ABSOLUTE_IMMUTABLE');
    expect(SPONSOR_EXISTENCE_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('produces a locked, deeply frozen envelope', () => {
    const { envelope } = buildAbsoluteExistence(sampleInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.identity)).toBe(true);
    expect(Object.isFrozen(envelope.graph)).toBe(true);
  });

  it('is bit-stable across re-executions with identical inputs', () => {
    const a = buildAbsoluteExistence(sampleInputs).envelope;
    const b = buildAbsoluteExistence(sampleInputs).envelope;
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(() => assertExistenceDeterminism(a, b)).not.toThrow();
  });

  it('rollback reproduces identical envelopes', () => {
    const a = buildAbsoluteExistence(sampleInputs).envelope;
    const rollback = buildAbsoluteExistence([...sampleInputs]).envelope;
    expect(a.envelopeSignature).toBe(rollback.envelopeSignature);
    expect(a.identity.absoluteIdentity).toBe(rollback.identity.absoluteIdentity);
    expect(a.lineage.terminalSignature).toBe(rollback.lineage.terminalSignature);
  });

  it('detects drift when an upstream signature differs', () => {
    const a = buildAbsoluteExistence(sampleInputs).envelope;
    const drifted = buildAbsoluteExistence(
      sampleInputs.map((i, idx) => (idx === 0 ? { ...i, upstreamSignature: 'drift' } : i)),
    ).envelope;
    expect(a.envelopeSignature).not.toBe(drifted.envelopeSignature);
    expect(() => assertExistenceDeterminism(a, drifted)).toThrow();
  });

  it('registers all 20 layers in canonical ontology order', () => {
    const { identity } = buildAbsoluteExistence(sampleInputs);
    expect(identity.nodes.length).toBe(20);
    expect(identity.nodes.map((n) => n.id)).toEqual([...SPONSOR_EXISTENCE_LAYER_ORDER]);
  });

  it('all existence invariants are satisfied', () => {
    const { invariants } = buildAbsoluteExistence(sampleInputs);
    expect(invariants.invariants.length).toBe(SPONSOR_EXISTENCE_INVARIANTS.length);
    for (const inv of invariants.invariants) expect(inv.verdict).toBe('satisfied');
  });

  it('graph includes identity, sequence and asserts edges', () => {
    const { graph } = buildAbsoluteExistence(sampleInputs);
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq.length).toBe(SPONSOR_EXISTENCE_LAYER_ORDER.length - 1);
    const ident = graph.edges.filter((e) => e.kind === 'identifies');
    expect(ident.length).toBe(SPONSOR_EXISTENCE_LAYER_ORDER.length);
    const asserts = graph.edges.filter((e) => e.kind === 'asserts');
    expect(asserts.length).toBe(
      SPONSOR_EXISTENCE_INVARIANTS.length * SPONSOR_EXISTENCE_LAYER_ORDER.length,
    );
  });

  it('graph is reproducible across executions', () => {
    const a = buildAbsoluteExistence(sampleInputs).graph;
    const b = buildAbsoluteExistence(sampleInputs).graph;
    expect(a.graphSignature).toBe(b.graphSignature);
  });

  it('lineage converges to a terminal ontology signature', () => {
    const { lineage, identity } = buildAbsoluteExistence(sampleInputs);
    expect(lineage.entries.length).toBe(identity.nodes.length);
    expect(lineage.terminalSignature).toBe(
      lineage.entries[lineage.entries.length - 1].cumulativeSignature,
    );
  });

  it('snapshot integrates absolute identity and every sub-signature', () => {
    const { snapshot, identity, invariants, graph, lineage } =
      buildAbsoluteExistence(sampleInputs);
    expect(snapshot.absoluteIdentity).toBe(identity.absoluteIdentity);
    expect(snapshot.invariantsSignature).toBe(invariants.invariantsSignature);
    expect(snapshot.graphSignature).toBe(graph.graphSignature);
    expect(snapshot.lineageSignature).toBe(lineage.lineageSignature);
    expect(snapshot.terminalSignature).toBe(lineage.terminalSignature);
    expect(snapshot.snapshotSignature).toBeTruthy();
  });

  it('post-lock mutation is rejected by frozen object semantics', () => {
    const { envelope } = buildAbsoluteExistence(sampleInputs);
    expect(() => {
      (envelope as unknown as { envelopeSignature: string }).envelopeSignature = 'tampered';
    }).toThrow();
  });
});
