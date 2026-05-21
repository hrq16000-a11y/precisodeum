/**
 * Phase 1.9.28 — Sponsor Proof Lineage.
 * Cumulative signed chain of proofs for auditable verification history.
 */
import { deepFreeze, signObject } from './sponsorVerificationInternals';
import type { SponsorConsistencyProofs } from './sponsorConsistencyProofs';

export interface SponsorProofLineageEntry {
  readonly index: number;
  readonly invariantId: string;
  readonly proofSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorProofLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorProofLineageEntry>;
  readonly lineageSignature: string;
}

export function computeProofLineage(proofs: SponsorConsistencyProofs): SponsorProofLineage {
  let prev = '';
  const entries: SponsorProofLineageEntry[] = proofs.proofs.map((p, index) => {
    const cumulativeSignature = signObject({ prev, id: p.invariantId, sig: p.proofSignature });
    prev = cumulativeSignature;
    return Object.freeze({
      index,
      invariantId: p.invariantId,
      proofSignature: p.proofSignature,
      cumulativeSignature,
    });
  });
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
  });
}
