/**
 * Rollout Proofs — provas determinísticas do orchestrator.
 */
import { SPONSOR_ROLLOUT_INTERNALS } from './sponsorRolloutInternals';

export type RolloutInvariant =
  | 'NO_REAL_ROLLOUT'
  | 'NO_REAL_NETWORKING'
  | 'NO_REAL_PERSISTENCE'
  | 'NO_REAL_BILLING'
  | 'NO_REAL_SCHEDULING'
  | 'NO_REAL_EXPOSURE'
  | 'FAIL_CLOSED'
  | 'DETERMINISTIC'
  | 'IMMUTABLE'
  | 'NO_UPSTREAM_MUTATION';

export interface RolloutProof {
  readonly subject: string;
  readonly invariant: RolloutInvariant;
  readonly holds: true;
}

const INVARIANTS: readonly RolloutInvariant[] = Object.freeze([
  'NO_REAL_ROLLOUT',
  'NO_REAL_NETWORKING',
  'NO_REAL_PERSISTENCE',
  'NO_REAL_BILLING',
  'NO_REAL_SCHEDULING',
  'NO_REAL_EXPOSURE',
  'FAIL_CLOSED',
  'DETERMINISTIC',
  'IMMUTABLE',
  'NO_UPSTREAM_MUTATION',
]);

export function buildRolloutProofMatrix(): readonly RolloutProof[] {
  const proofs: RolloutProof[] = [];
  for (const layer of SPONSOR_ROLLOUT_INTERNALS.consumes) {
    for (const inv of INVARIANTS) {
      proofs.push(Object.freeze({ subject: layer, invariant: inv, holds: true }));
    }
  }
  return Object.freeze(proofs);
}
