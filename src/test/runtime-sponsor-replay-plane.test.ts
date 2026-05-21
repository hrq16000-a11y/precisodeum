/**
 * Phase 1.9.27 — Sponsor Deterministic Replay Plane · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runReplayPlane,
  replayWorldState,
  reconstructHistoricalSnapshot,
  validateReplayEquivalence,
  assertReplayDeterminism,
  generateReplayTimeline,
  buildEquivalenceMatrix,
  computeReplayLineage,
  buildReplaySnapshot,
  buildReplayEnvelope,
  lockReplayEnvelope,
  buildExecutionFrames,
  SPONSOR_REPLAY_INTERNALS,
  SPONSOR_REPLAY_LAYER_ORDER,
  SponsorReplayDeterminismError,
  type SponsorReplayTickInput,
} from '@/lib/runtimeSponsorReplayPlane';

const layersAt = (tag: string) =>
  SPONSOR_REPLAY_LAYER_ORDER.map((layer) => ({ layer, signature: `${tag}-${layer}` }));

const fixture: ReadonlyArray<SponsorReplayTickInput> = [
  { tick: 1, layers: layersAt('t1') },
  { tick: 2, layers: layersAt('t2') },
  { tick: 3, layers: layersAt('t3') },
];

describe('Sponsor Deterministic Replay Plane (Phase 1.9.27)', () => {
  it('internals enforce read-only/zero-mutation invariants', () => {
    expect(SPONSOR_REPLAY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_REPLAY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_REPLAY_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_REPLAY_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_REPLAY_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_REPLAY_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('produces bit-stable envelopes for identical inputs (deterministic replay)', () => {
    const a = runReplayPlane(fixture);
    const b = runReplayPlane(fixture);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(validateReplayEquivalence(a.envelope, b.envelope)).toBe(true);
    expect(() => assertReplayDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('rollback reproduces identical replay envelopes', () => {
    const a = replayWorldState(fixture);
    const b = replayWorldState(fixture);
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
  });

  it('execution frames cover all 13 layers (1.9.14 → 1.9.26)', () => {
    const frames = buildExecutionFrames(fixture[0]);
    expect(frames).toHaveLength(13);
    expect(frames.map((f) => f.layer)).toEqual([...SPONSOR_REPLAY_LAYER_ORDER]);
  });

  it('timeline orders ticks canonically (asc)', () => {
    const out = generateReplayTimeline([
      { tick: 5, layers: layersAt('t5') },
      { tick: 1, layers: layersAt('t1') },
      { tick: 3, layers: layersAt('t3') },
    ]);
    expect(out.ticks.map((t) => t.tick)).toEqual([1, 3, 5]);
  });

  it('equivalence matrix detects drift and confirms self-equivalence', () => {
    const timeline = generateReplayTimeline(fixture);
    const matrix = buildEquivalenceMatrix(timeline);
    const self = matrix.cells.find((c) => c.fromTick === 1 && c.toTick === 1);
    expect(self?.equivalent).toBe(true);
    const cross = matrix.cells.find((c) => c.fromTick === 1 && c.toTick === 2);
    expect(cross?.equivalent).toBe(false);
    expect(cross?.drift.length).toBeGreaterThan(0);
  });

  it('lineage forms a cumulative signed chain', () => {
    const timeline = generateReplayTimeline(fixture);
    const lineage = computeReplayLineage(timeline);
    expect(lineage.entries).toHaveLength(3);
    const sigs = new Set(lineage.entries.map((e) => e.cumulativeSignature));
    expect(sigs.size).toBe(3);
  });

  it('snapshot reflects timeline and matrix signatures', () => {
    const timeline = generateReplayTimeline(fixture);
    const matrix = buildEquivalenceMatrix(timeline);
    const snap = buildReplaySnapshot(timeline, matrix);
    expect(snap.tickCount).toBe(3);
    expect(snap.frameCount).toBe(3 * 13);
    expect(snap.timelineSignature).toBe(timeline.timelineSignature);
    expect(snap.matrixSignature).toBe(matrix.matrixSignature);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runReplayPlane(fixture);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(() => lockReplayEnvelope(envelope)).not.toThrow();
  });

  it('reconstructHistoricalSnapshot returns exact tick or null', () => {
    expect(reconstructHistoricalSnapshot(fixture, 2)?.tick).toBe(2);
    expect(reconstructHistoricalSnapshot(fixture, 999)).toBeNull();
  });

  it('detects envelope drift via assertReplayDeterminism', () => {
    const a = runReplayPlane(fixture);
    const drifted = runReplayPlane([
      ...fixture,
      { tick: 4, layers: layersAt('t4') },
    ]);
    expect(() => assertReplayDeterminism(a.envelope, drifted.envelope)).toThrow(
      SponsorReplayDeterminismError,
    );
  });

  it('does not mutate the provided input arrays', () => {
    const inputs: SponsorReplayTickInput[] = [
      { tick: 2, layers: layersAt('t2') },
      { tick: 1, layers: layersAt('t1') },
    ];
    const before = inputs.map((i) => i.tick);
    runReplayPlane(inputs);
    expect(inputs.map((i) => i.tick)).toEqual(before);
  });

  it('handles empty input deterministically', () => {
    const a = runReplayPlane([]);
    const b = runReplayPlane([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.tickCount).toBe(0);
    expect(a.snapshot.frameCount).toBe(0);
  });

  it('missing layer signatures normalize to null without breaking determinism', () => {
    const partial: SponsorReplayTickInput[] = [
      { tick: 1, layers: [{ layer: 'mesh', signature: 'm1' }] },
    ];
    const a = runReplayPlane(partial);
    const b = runReplayPlane(partial);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    const frame = a.timeline.ticks[0].frames.find((f) => f.layer === 'world');
    expect(frame?.signature).toBeNull();
  });
});
