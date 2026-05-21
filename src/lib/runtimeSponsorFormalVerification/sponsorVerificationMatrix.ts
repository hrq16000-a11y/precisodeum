/**
 * Phase 1.9.28 — Sponsor Verification Matrix.
 * Cross-layer equivalence and per-invariant status matrix.
 */
import { deepFreeze, signObject } from './sponsorVerificationInternals';
import type { SponsorConsistencyProofs, SponsorProofVerdict } from './sponsorConsistencyProofs';

export interface SponsorVerificationMatrixCell {
  readonly invariantId: string;
  readonly verdict: SponsorProofVerdict;
  readonly severity: 'critical' | 'structural' | 'advisory';
  readonly cellSignature: string;
}

export interface SponsorVerificationMatrix {
  readonly version: 'v1';
  readonly cells: ReadonlyArray<SponsorVerificationMatrixCell>;
  readonly totals: Readonly<Record<SponsorProofVerdict, number>>;
  readonly matrixSignature: string;
}

export function generateVerificationMatrix(
  proofs: SponsorConsistencyProofs,
): SponsorVerificationMatrix {
  const cells: SponsorVerificationMatrixCell[] = proofs.proofs.map((p) =>
    Object.freeze({
      invariantId: p.invariantId,
      verdict: p.verdict,
      severity: p.severity,
      cellSignature: signObject({
        id: p.invariantId,
        verdict: p.verdict,
        severity: p.severity,
        proof: p.proofSignature,
      }),
    }),
  );
  const totals: Record<SponsorProofVerdict, number> = {
    satisfied: 0,
    violated: 0,
    inapplicable: 0,
  };
  for (const c of cells) totals[c.verdict]++;
  const matrixSignature = signObject({
    cells: cells.map((c) => c.cellSignature),
    totals,
  });
  return deepFreeze({
    version: 'v1' as const,
    cells: Object.freeze(cells),
    totals: Object.freeze(totals),
    matrixSignature,
  });
}
