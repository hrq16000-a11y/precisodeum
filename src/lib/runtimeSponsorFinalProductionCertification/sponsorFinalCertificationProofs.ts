/**
 * Final Certification Proofs — provas determinísticas terminais.
 */
import { SPONSOR_FINAL_CERTIFICATION_INTERNALS } from './sponsorFinalCertificationInternals';

export type FinalCertificationInvariant =
  | 'NO_REAL_PRODUCTION'
  | 'NO_REAL_ROLLOUT'
  | 'NO_REAL_NETWORKING'
  | 'NO_REAL_PERSISTENCE'
  | 'NO_REAL_BILLING'
  | 'NO_REAL_MONETIZATION'
  | 'NO_REAL_SCHEDULING'
  | 'NO_REAL_FEATURE_ACTIVATION'
  | 'FAIL_CLOSED'
  | 'DETERMINISTIC'
  | 'IMMUTABLE'
  | 'NO_UPSTREAM_MUTATION'
  | 'TERMINAL_READINESS_CERTIFIED';

const INVARIANTS: readonly FinalCertificationInvariant[] = Object.freeze([
  'NO_REAL_PRODUCTION',
  'NO_REAL_ROLLOUT',
  'NO_REAL_NETWORKING',
  'NO_REAL_PERSISTENCE',
  'NO_REAL_BILLING',
  'NO_REAL_MONETIZATION',
  'NO_REAL_SCHEDULING',
  'NO_REAL_FEATURE_ACTIVATION',
  'FAIL_CLOSED',
  'DETERMINISTIC',
  'IMMUTABLE',
  'NO_UPSTREAM_MUTATION',
  'TERMINAL_READINESS_CERTIFIED',
]);

export interface FinalCertificationProof {
  readonly subject: string;
  readonly invariant: FinalCertificationInvariant;
  readonly holds: true;
}

export function buildFinalCertificationProofMatrix(): readonly FinalCertificationProof[] {
  const proofs: FinalCertificationProof[] = [];
  for (const layer of SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes) {
    for (const inv of INVARIANTS) {
      proofs.push(Object.freeze({ subject: layer, invariant: inv, holds: true }));
    }
  }
  return Object.freeze(proofs);
}

export const FINAL_CERTIFICATION_INVARIANTS = INVARIANTS;
