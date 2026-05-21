/**
 * Phase 1.9.28 — Sponsor Formal Verification Plane.
 * Top-level orchestrator. Verifies invariants, builds proofs, generates the
 * verification matrix and lineage, and seals a locked proof envelope.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import {
  SponsorVerificationDeterminismError,
  SponsorInvariantViolationError,
} from './sponsorVerificationInternals';
import {
  buildInvariantRegistry,
  type SponsorInvariantRegistry,
} from './sponsorInvariantRegistry';
import {
  buildConsistencyProofs,
  hasCriticalViolation,
  type SponsorConsistencyProofs,
  type SponsorVerificationLayerInput,
} from './sponsorConsistencyProofs';
import {
  generateVerificationMatrix,
  type SponsorVerificationMatrix,
} from './sponsorVerificationMatrix';
import { computeProofLineage, type SponsorProofLineage } from './sponsorProofLineage';
import {
  buildVerificationSnapshot,
  type SponsorDeterministicVerificationSnapshot,
} from './sponsorVerificationSnapshot';
import {
  buildProofEnvelope,
  lockProofEnvelope,
  type SponsorProofEnvelope,
} from './sponsorProofEnvelope';

export interface SponsorFormalVerificationResult {
  readonly registry: SponsorInvariantRegistry;
  readonly proofs: SponsorConsistencyProofs;
  readonly matrix: SponsorVerificationMatrix;
  readonly lineage: SponsorProofLineage;
  readonly snapshot: SponsorDeterministicVerificationSnapshot;
  readonly envelope: SponsorProofEnvelope;
}

export function runFormalVerificationPlane(
  inputs: ReadonlyArray<SponsorVerificationLayerInput> = [],
): SponsorFormalVerificationResult {
  const registry = buildInvariantRegistry();
  const proofs = buildConsistencyProofs(registry, inputs);
  const matrix = generateVerificationMatrix(proofs);
  const lineage = computeProofLineage(proofs);
  const snapshot = buildVerificationSnapshot(registry, proofs, matrix, lineage);
  const envelope = buildProofEnvelope(registry, proofs, matrix, lineage, snapshot);
  lockProofEnvelope(envelope);
  return Object.freeze({ registry, proofs, matrix, lineage, snapshot, envelope });
}

export function verifySystemInvariants(
  inputs: ReadonlyArray<SponsorVerificationLayerInput>,
): SponsorProofEnvelope {
  return runFormalVerificationPlane(inputs).envelope;
}

export function validateCrossLayerEquivalence(
  a: SponsorProofEnvelope,
  b: SponsorProofEnvelope,
): boolean {
  return a.envelopeSignature === b.envelopeSignature;
}

/**
 * FAIL-CLOSED: throws on any critical invariant violation.
 */
export function assertNoCriticalViolations(envelope: SponsorProofEnvelope): void {
  if (!hasCriticalViolation(envelope.proofs)) return;
  const first = envelope.proofs.proofs.find(
    (p) => p.verdict === 'violated' && p.severity === 'critical',
  );
  if (!first) return;
  throw new SponsorInvariantViolationError(
    first.invariantId,
    `critical invariant violated: ${first.evidence.join(',')}`,
  );
}

export function assertVerificationDeterminism(
  a: SponsorProofEnvelope,
  b: SponsorProofEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorVerificationDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorVerificationDeterminismError('registry signature drift');
  }
  if (a.proofs.proofsSignature !== b.proofs.proofsSignature) {
    throw new SponsorVerificationDeterminismError('proofs signature drift');
  }
  if (a.matrix.matrixSignature !== b.matrix.matrixSignature) {
    throw new SponsorVerificationDeterminismError('matrix signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorVerificationDeterminismError('lineage signature drift');
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorVerificationDeterminismError('snapshot signature drift');
  }
}
