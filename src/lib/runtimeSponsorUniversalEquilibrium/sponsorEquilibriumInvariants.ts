/**
 * Phase 1.9.36 — Sponsor Equilibrium Invariants.
 */
import {
  SPONSOR_EQUILIBRIUM_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorEquilibriumInvariantId,
} from './sponsorEquilibriumInternals';

export interface SponsorEquilibriumInvariant {
  readonly id: SponsorEquilibriumInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorEquilibriumInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorEquilibriumInvariant>;
  readonly invariantsSignature: string;
}

export function generateEquilibriumInvariants(): SponsorEquilibriumInvariantRegistry {
  const invariants: SponsorEquilibriumInvariant[] = SPONSOR_EQUILIBRIUM_INVARIANTS.map((spec) =>
    Object.freeze({
      id: spec.id,
      title: spec.title,
      statement: spec.statement,
      invariantSignature: signObject({ id: spec.id, statement: spec.statement }),
    }),
  );
  const invariantsSignature = signObject(invariants.map((i) => i.invariantSignature));
  return deepFreeze({
    version: 'v1' as const,
    invariants: Object.freeze(invariants),
    invariantsSignature,
  });
}
