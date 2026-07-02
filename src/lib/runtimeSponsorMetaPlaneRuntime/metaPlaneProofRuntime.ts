/**
 * Phase 1.9.46 — Proof runtime (shared, read-only).
 */
import { deepFreeze } from './metaPlaneDeepFreeze';
import { signObject } from './metaPlaneFNV';

export interface CanonicalProof {
  readonly subject: string;
  readonly invariant: string;
  readonly proofSignature: string;
}

export interface CanonicalProofMatrix {
  readonly version: 'v1';
  readonly proofs: ReadonlyArray<CanonicalProof>;
  readonly proofsSignature: string;
}

export function normalizeProofSet(proofs: ReadonlyArray<CanonicalProof>): ReadonlyArray<CanonicalProof> {
  const sorted = [...proofs]
    .map((p) => Object.freeze({ ...p }))
    .sort((a, b) => {
      const ka = `${a.subject}\u0000${a.invariant}`;
      const kb = `${b.subject}\u0000${b.invariant}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return Object.freeze(sorted);
}

export function buildProofMatrix(
  subjects: ReadonlyArray<string>,
  invariants: ReadonlyArray<string>,
): CanonicalProofMatrix {
  const proofs: CanonicalProof[] = [];
  for (const subject of subjects) {
    for (const invariant of invariants) {
      proofs.push(Object.freeze({
        subject,
        invariant,
        proofSignature: signObject({ subject, invariant }),
      }));
    }
  }
  const normalized = normalizeProofSet(proofs);
  return deepFreeze({
    version: 'v1' as const,
    proofs: normalized,
    proofsSignature: signObject(normalized.map((p) => p.proofSignature)),
  });
}

export function signProofPayload(matrix: CanonicalProofMatrix): string {
  return matrix.proofsSignature;
}
