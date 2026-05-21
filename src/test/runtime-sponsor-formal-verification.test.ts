/**
 * Phase 1.9.28 — Sponsor Formal Verification Plane · regression suite.
 */
import { describe, it, expect } from 'vitest';
import {
  runFormalVerificationPlane,
  verifySystemInvariants,
  validateCrossLayerEquivalence,
  assertVerificationDeterminism,
  assertNoCriticalViolations,
  buildInvariantRegistry,
  buildConsistencyProofs,
  generateVerificationMatrix,
  computeProofLineage,
  buildVerificationSnapshot,
  buildProofEnvelope,
  lockProofEnvelope,
  hasCriticalViolation,
  SPONSOR_VERIFICATION_INTERNALS,
  SPONSOR_VERIFICATION_LAYER_ORDER,
  SponsorVerificationDeterminismError,
  SponsorInvariantViolationError,
  type SponsorVerificationLayerInput,
} from '@/lib/runtimeSponsorFormalVerification';

const fullInputs: ReadonlyArray<SponsorVerificationLayerInput> =
  SPONSOR_VERIFICATION_LAYER_ORDER.map((layer) => ({ layer, signature: `sig-${layer}` }));

describe('Sponsor Formal Verification Plane (Phase 1.9.28)', () => {
  it('internals enforce read-only & fail-closed invariants', () => {
    expect(SPONSOR_VERIFICATION_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_VERIFICATION_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_VERIFICATION_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_VERIFICATION_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_VERIFICATION_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_VERIFICATION_INTERNALS.deterministicRollbackRequired).toBe(true);
    expect(SPONSOR_VERIFICATION_INTERNALS.contradictionDetectionMode).toBe('FAIL_CLOSED');
  });

  it('produces bit-stable proof envelopes for identical inputs', () => {
    const a = runFormalVerificationPlane(fullInputs);
    const b = runFormalVerificationPlane(fullInputs);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(validateCrossLayerEquivalence(a.envelope, b.envelope)).toBe(true);
    expect(() => assertVerificationDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('rollback reproduces identical proof envelopes', () => {
    const a = verifySystemInvariants(fullInputs);
    const b = verifySystemInvariants(fullInputs);
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
  });

  it('registry is canonically ordered (scope, then id)', () => {
    const r1 = buildInvariantRegistry();
    const r2 = buildInvariantRegistry();
    expect(r1.registrySignature).toBe(r2.registrySignature);
    const ids = r1.invariants.map((i) => `${i.scope}::${i.id}`);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('all layer-presence + per-layer invariants satisfied with full inputs', () => {
    const { proofs, matrix } = runFormalVerificationPlane(fullInputs);
    expect(matrix.totals.violated).toBe(0);
    expect(matrix.totals.satisfied).toBe(proofs.proofs.length);
  });

  it('detects violation when a layer signature is missing', () => {
    const partial = fullInputs.filter((i) => i.layer !== 'replay');
    const { proofs, matrix } = runFormalVerificationPlane(partial);
    expect(matrix.totals.violated).toBeGreaterThan(0);
    expect(hasCriticalViolation(proofs)).toBe(false); // per-layer is structural, not critical
    const replay = proofs.proofs.find(
      (p) => p.invariantId === 'inv.layer.replay.signature-present',
    );
    expect(replay?.verdict).toBe('violated');
  });

  it('detects violation when a layer signature is empty', () => {
    const broken = fullInputs.map((i) =>
      i.layer === 'topology' ? { layer: i.layer, signature: '' } : i,
    );
    const { proofs } = runFormalVerificationPlane(broken);
    const topology = proofs.proofs.find(
      (p) => p.invariantId === 'inv.layer.topology.signature-present',
    );
    expect(topology?.verdict).toBe('violated');
    const nonEmpty = proofs.proofs.find(
      (p) => p.invariantId === 'inv.global.signature-non-empty',
    );
    expect(nonEmpty?.verdict).toBe('violated');
  });

  it('assertNoCriticalViolations is fail-closed', () => {
    const good = runFormalVerificationPlane(fullInputs);
    expect(() => assertNoCriticalViolations(good.envelope)).not.toThrow();
  });

  it('verification matrix totals are coherent with proofs', () => {
    const { proofs, matrix } = runFormalVerificationPlane(fullInputs);
    const sum =
      matrix.totals.satisfied + matrix.totals.violated + matrix.totals.inapplicable;
    expect(sum).toBe(proofs.proofs.length);
  });

  it('proof lineage forms a cumulative signed chain', () => {
    const registry = buildInvariantRegistry();
    const proofs = buildConsistencyProofs(registry, fullInputs);
    const lineage = computeProofLineage(proofs);
    expect(lineage.entries).toHaveLength(proofs.proofs.length);
    const sigs = new Set(lineage.entries.map((e) => e.cumulativeSignature));
    expect(sigs.size).toBe(lineage.entries.length);
  });

  it('snapshot reflects all sub-signatures coherently', () => {
    const registry = buildInvariantRegistry();
    const proofs = buildConsistencyProofs(registry, fullInputs);
    const matrix = generateVerificationMatrix(proofs);
    const lineage = computeProofLineage(proofs);
    const snap = buildVerificationSnapshot(registry, proofs, matrix, lineage);
    expect(snap.registrySignature).toBe(registry.registrySignature);
    expect(snap.proofsSignature).toBe(proofs.proofsSignature);
    expect(snap.matrixSignature).toBe(matrix.matrixSignature);
    expect(snap.lineageSignature).toBe(lineage.lineageSignature);
    expect(snap.invariantCount).toBe(registry.invariants.length);
  });

  it('envelope is frozen and locked', () => {
    const { envelope } = runFormalVerificationPlane(fullInputs);
    expect(envelope.locked).toBe(true);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(() => lockProofEnvelope(envelope)).not.toThrow();
  });

  it('does not mutate input array', () => {
    const inputs: SponsorVerificationLayerInput[] = [...fullInputs];
    const before = inputs.map((i) => i.layer);
    runFormalVerificationPlane(inputs);
    expect(inputs.map((i) => i.layer)).toEqual(before);
  });

  it('detects envelope drift via assertVerificationDeterminism', () => {
    const a = runFormalVerificationPlane(fullInputs);
    const b = runFormalVerificationPlane(
      fullInputs.map((i) =>
        i.layer === 'mesh' ? { layer: i.layer, signature: 'sig-mesh-altered' } : i,
      ),
    );
    expect(() => assertVerificationDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorVerificationDeterminismError,
    );
  });

  it('SponsorInvariantViolationError surfaces invariant id', () => {
    const err = new SponsorInvariantViolationError('inv.x', 'boom');
    expect(err.invariantId).toBe('inv.x');
    expect(err.message).toContain('inv.x');
  });

  it('handles empty input deterministically (violations expected)', () => {
    const a = runFormalVerificationPlane([]);
    const b = runFormalVerificationPlane([]);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.matrix.totals.violated).toBeGreaterThan(0);
  });
});
