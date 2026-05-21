/**
 * Phase 1.9.28 — Sponsor Verification Snapshot.
 * Deterministic structural snapshot of a verification execution.
 */
import { deepFreeze, signObject } from './sponsorVerificationInternals';
import type { SponsorInvariantRegistry } from './sponsorInvariantRegistry';
import type { SponsorConsistencyProofs } from './sponsorConsistencyProofs';
import type { SponsorVerificationMatrix } from './sponsorVerificationMatrix';
import type { SponsorProofLineage } from './sponsorProofLineage';

export interface SponsorDeterministicVerificationSnapshot {
  readonly version: 'v1';
  readonly invariantCount: number;
  readonly satisfiedCount: number;
  readonly violatedCount: number;
  readonly inapplicableCount: number;
  readonly registrySignature: string;
  readonly proofsSignature: string;
  readonly matrixSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function buildVerificationSnapshot(
  registry: SponsorInvariantRegistry,
  proofs: SponsorConsistencyProofs,
  matrix: SponsorVerificationMatrix,
  lineage: SponsorProofLineage,
): SponsorDeterministicVerificationSnapshot {
  const snapshotSignature = signObject({
    registry: registry.registrySignature,
    proofs: proofs.proofsSignature,
    matrix: matrix.matrixSignature,
    lineage: lineage.lineageSignature,
    totals: matrix.totals,
  });
  return deepFreeze({
    version: 'v1' as const,
    invariantCount: registry.invariants.length,
    satisfiedCount: matrix.totals.satisfied,
    violatedCount: matrix.totals.violated,
    inapplicableCount: matrix.totals.inapplicable,
    registrySignature: registry.registrySignature,
    proofsSignature: proofs.proofsSignature,
    matrixSignature: matrix.matrixSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
